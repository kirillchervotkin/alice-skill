import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import config from "../config";
import { YandexGPT, YandexGPTInputs } from "@langchain/yandex/llms";
import { LLM } from "@langchain/core/language_models/llms";
import { CreateIamTokenResponse } from "@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/iam/v1/iam_token_service";
import { ForbiddenException, Inject, Injectable, OnModuleDestroy, RequestTimeoutException, UnauthorizedException } from "@nestjs/common";
import * as jose from 'node-jose'
import { DocumentFlowClientIBSessionException, DocumentFlowClientInternalServerErrorException, DocumentFlowClientUnknowException } from "../exceptions";
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { Cron, CronExpression } from "@nestjs/schedule";


export interface Task {
  id: string
  name: string,
  deadline: string
}

export interface Project {
  id: string,
  name: string
}

export interface Stufftime {
  taskId: string
  userId: string
  workTypeId: string
  dateTime: Date
  countOfMinutes: string
  description: string
}

export interface Worktypes {
  id: string,
  name: string
}

export interface ErrorResponse {
  error?: string;
}


export class DocumentFlowApiClient implements OnModuleDestroy {
  private client: AxiosInstance;
  private readonly baseUrl = config.baseUrl;
  private readonly auth = {
    username: config.authDO.username,
    password: config.authDO.password
  };

  constructor() {
    const jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar,
        baseURL: this.baseUrl,
        auth: this.auth
      })
    );

    this.addRequestInterceptors();
    this.addResponseInterceptors();
  }

  private addRequestInterceptors() {
    this.client.interceptors.request.use(config => {
      config.headers.IBSession = 'start';
      return config;
    });
  }


  public async onModuleDestroy() {
    await this.closeSession();
    console.log('session close');
  }

  public async closeSession() {

    const response = await this.client.get('tasks', {
      headers: { IBSession: 'finish' }
    });
    return response.data;

  }

  public async checkOverdueTasks(userId: string) {
    const response = await this.client.get('checkOverdueTasks', {
      params: { userId }
    });
    return response.data.result;
  }

  public async getTasks(userId: string) {
    const response = await this.client.get('tasks', {
      params: { userId }
    });
    return response.data;
  }

  public async getWorktypes(): Promise<Worktypes[]> {
    const response: AxiosResponse = await this.client.get('worktypes');
    const worktypes: Worktypes[] = response.data;

    return worktypes.filter(item =>
      !item.name.includes("(не использовать)")
    );
  }

  public async keepAlive() {
    await this.client.get('tasks');
  }

  public async getTaskByName(userId: string, name: string): Promise<Task> {
    const response = await this.client.get('task', {
      params: { userId, taskName: name }
    });
    return response.data;
  }

  public async addStufftime(stufftime: Stufftime): Promise<void> {
    const payload = {
      ...stufftime,
      dateTime: this.formatDateToYYYYMMDDHHMMSS(stufftime.dateTime)
    };
    const response = await this.client.post('stufftime', payload);
    return response.data;
  }

  public async getProjectByName(name: string) {
    const response = await this.client.get('project', {
      params: { projectName: name }
    });
    return response.data;
  }

  public async getStafftimeByProjectId(projectId: string) {
    const response = await this.client.get('stufftime', {
      params: { projectId }
    });
    return response.data;
  }

  public async getStafftimeTodayByUserId(userId: string) {
    const response = await this.client.get('stufftime', {
      params: { userId }
    });
    return response.data;
  }

  private addResponseInterceptors() {
    this.client.interceptors.response.use(
      response => response,
      (error: unknown) => this.handleResponseError(error)
    );
  }

  private handleResponseError(error: unknown): Promise<never> {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(new DocumentFlowClientUnknowException('Unknown error occurred'));
    }

    if (!error.response) {
      return Promise.reject(new RequestTimeoutException('Network error occurred'));
    }

    const responseData = this.parseErrorResponse(error.response.data);
    const errorMessage = responseData.error ?? 'Unknown error';

    if (this.isSessionError(errorMessage)) {
      return Promise.reject(new DocumentFlowClientIBSessionException('IBSession header is not set'));
    }

    return this.handleErrorByStatus(error.response.status, errorMessage);
  }

  private parseErrorResponse(data: unknown): ErrorResponse {

    return data as ErrorResponse;
  }

  private isSessionError(message: string): boolean {
    return message.includes('Не указан заголовок управления сеансами или куки с идентификатором сеанса');
  }

  private handleErrorByStatus(status: number, message: string): Promise<never> {
    const exceptionMap: Record<number, Error> = {
      401: new UnauthorizedException('Authentication required'),
      403: new ForbiddenException('Access denied'),
      500: new DocumentFlowClientInternalServerErrorException('Internal server error')
    }

    return Promise.reject(
      exceptionMap[status]
      ?? new DocumentFlowClientUnknowException(`Unexpected error: ${message}`, status)
    );
  }





  public formatDateToYYYYMMDDHHMMSS(date: Date): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

}

interface AimTokenProvider {
  getIamTokenRespone(): Promise<CreateIamTokenResponse>;
}

class AimTokenProviderError extends Error {
  public innerError: any | undefined;
  constructor(message: string, innerError?: any) {
    super(message);
    this.name = 'AimTokenProviderError';
    this.innerError = innerError;
  }
}

@Injectable()
export class YandexAimTokenProvider implements AimTokenProvider {

  private iamToken: Promise<CreateIamTokenResponse>

  constructor(@Inject('JWT_TOKEN_PROVIDER') private readonly jwtTokenProvider: JwtTokenProvider,
  ) {
    this.iamToken = this.getIamTokenRespone();
  };
  public async getIamTokenRespone(): Promise<CreateIamTokenResponse> {

    let jwt = await this.jwtTokenProvider.getJWTToken();
    try {
      let response = await axios.post('https://iam.api.cloud.yandex.net/iam/v1/tokens',
        {
          "jwt": jwt,
        },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
          },
        });
      const iamTokenResponse: CreateIamTokenResponse = {
        $type: "yandex.cloud.iam.v1.CreateIamTokenResponse",
        iamToken: response.data.iamToken,
        expiresAt: new Date(response.data.expiresAt)
      }
      return iamTokenResponse;
    } catch (error) {
      if (error.response) {
        throw new AimTokenProviderError("Failed to get data from https://iam.api.cloud.yandex.net/iam/v1/tokens"
          + "because server returned a status code " + error.response.status + " and message " + error.response.data.message, error);
      } else if (error.request) {
        throw new AimTokenProviderError("Failed to get data from https://iam.api.cloud.yandex.net/iam/v1/tokens because server is not responding");
      } else {
        throw new AimTokenProviderError("Unknown error");
      }
    }

  }


}

interface JwtTokenProvider {
  getJWTToken(): Promise<string>;
}

@Injectable()
export class YandexJWTTokenProvider implements JwtTokenProvider {
  constructor(
    @Inject('KEY') private readonly keyId: string,
    @Inject('PRIVATE_KEY') private key: string,
    @Inject('SERVICE_ACCOUNT_ID') private readonly serviceAccountId: string,
  ) {
  }

  async getJWTToken(): Promise<string> {
    let now = Math.floor(new Date().getTime() / 1000);
    let payload = {
      aud: "https://iam.api.cloud.yandex.net/iam/v1/tokens",
      iss: this.serviceAccountId,
      iat: now,
      exp: now + 3600
    };

    let baseKey = await jose.JWK.asKey(this.key, 'pem', { kid: this.keyId, alg: 'PS256' })
    let jwt: any = await jose.JWS.createSign({ format: 'compact' }, baseKey).update(JSON.stringify(payload)).final()
    return jwt;
  }
}

export interface LLMmodel {
  getModel(): Promise<LLM>
}


export class YandexGPTmodel {

  private model: YandexGPT;

  private iamTokenResponse: CreateIamTokenResponse

  constructor(
    @Inject('TOKEN_PROVIDER') private readonly iamTokenProvider: AimTokenProvider,
    @Inject('FOLDER_ID') private readonly folderId: string,
    @Inject('MODEL_URI') private readonly modelURI: string

  ) { }

  private isTokenExpired(): boolean {
    if (!this.iamTokenResponse) {
      return true;
    }
    let tokenLifetime;
    const expiresAt: Date | undefined = this.iamTokenResponse.expiresAt;
    if (expiresAt) {
      tokenLifetime = (new Date(expiresAt).getTime() - (Date.now() + 60 * 60 * 1000));
    } else {
      tokenLifetime = 0;
    }
    return tokenLifetime <= 0;
  }

  async getModel(): Promise<LLM> {
    const options: YandexGPTInputs = {
      folderID: this.folderId,
      modelURI: `gpt://${this.folderId}/${this.modelURI}`,
      //   modelVersion: `rc`,
      temperature: 0,
      cache: true,
    }
    if (this.isTokenExpired()) {
      this.iamTokenResponse = await this.iamTokenProvider.getIamTokenRespone();
      options.iamToken = this.iamTokenResponse.iamToken;
      this.model = new YandexGPT(options);
    }
    return this.model
  }
}

@Injectable()
export class AItransform {

  constructor(@Inject('LLM_MODEL') private readonly model: LLMmodel) { }

  async toMinutes(text: string): Promise<number | null> {

    try {

      const model: LLM = await this.model.getModel();
      const res: string = await model.invoke([`Преобразуй "${text}" в количество минут. Верни только число. Если строку нельзя преобразовать верни null`]);
      const time = Number.parseInt(res);
      if (isNaN(time)) {
        return null;
      } else {
        return time;
      }

    } catch (error) {
      throw error;
    }
  }

}

@Injectable()
export class KeepAlive {
  constructor(
    private readonly documentFlowApiClient: DocumentFlowApiClient,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async runEveryMinute() {
    try {
      await this.documentFlowApiClient.keepAlive();
    } catch (error) {
      console.log(error);
    }
  }
}


interface YandexGPTRequest {
  modelUri: string;
  completionOptions: {
    maxTokens: number;
    temperature: number;
  };
  messages: Array<{
    role: string;
    text: string;
  }>;
}

interface YandexGPTResponse {
  result: {
    alternatives: Array<{
      message: {
        text: string;
      };
    }>;
  };
}

interface BaseEntity {
  id: string;
  name: string;
}

class InvalidUUIDError extends Error {

  constructor(value: string) {
    super(`Недопустимый UUID: ${value}`);
    this.name = 'InvalidUUIDError';
  }
}

export class YandexGPTClient {

  private readonly baseUrl: string = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
  private iamTokenResponse: CreateIamTokenResponse;
  private yandexGptLiteURI: string

  constructor(
    @Inject('TOKEN_PROVIDER') private readonly iamTokenProvider: AimTokenProvider,
    @Inject('FOLDER_ID') private readonly folderId: string,
    @Inject('MODEL_URI') private readonly modelURI: string,
  ) {
    this.yandexGptLiteURI = `gpt://${this.folderId}/yandexgpt-lite/rc`;
  }

  private isTokenExpired(): boolean {
    if (!this.iamTokenResponse) {
      return true;
    }
    let tokenLifetime;
    const expiresAt: Date | undefined = this.iamTokenResponse.expiresAt;
    if (expiresAt) {
      tokenLifetime = (new Date(expiresAt).getTime() - (Date.now() + 60 * 60 * 1000));
    } else {
      tokenLifetime = 0;
    }
    return tokenLifetime <= 0;
  }

  private baseEntitysToText(baseEntitys: BaseEntity[]) {

    return baseEntitys.reduce<string>((text: string, baseEntity: BaseEntity) => text + `Имя: ${baseEntity.name} id: ${baseEntity.id} \n\n`, '');

  }

  async splitIntoSentencesPreserveOriginal(text: string) {
    const prompt = `Разбей на предложения и расставь запятые не меняя исходный текст `
    const description: string = await this.run(prompt, text, this.yandexGptLiteURI);
    return description;
  }

  async textoMinutes(text: string): Promise<number | null> {

    const systemText: string = `Преобразуй текст в количество минут. Верни только число. Если строку нельзя преобразовать верни null`
    const userText: string = text;
    const response: string = await this.run(systemText, userText, this.yandexGptLiteURI);
    const minutes: number = Number.parseInt(response);
    return Number.isNaN(minutes) ? null : minutes;

  }

  async findItemIdByName(baseEntitys: BaseEntity[], name: string): Promise<string | null> {

    const systemText: string = `У тебя текст распознанный голосом. Определи есть элемент "${name}" в списке ниже с учетом возможных неточностей распознания голоса\nЕсли элемент есть, то верни исключительно только id этого элемента и ничего более, если нет верни null и ничего больше. Очень важно, в ответе может быть либо id ли значение null и ничего больше.`
    const userText: string = this.baseEntitysToText(baseEntitys);
    const id: string | null = await this.run(systemText, userText, this.yandexGptLiteURI);
    if (!id || id.toLowerCase() === 'null') return null;
    if (!this.isValidUUID(id)) {
      throw new InvalidUUIDError(id);
    }
    return id;
  }

  async run(systemText: string, userText: string, modelURI: string): Promise<string> {
    const requestBody: YandexGPTRequest = {
      modelUri: modelURI,
      completionOptions: {
        maxTokens: 500,
        temperature: 0
      },
      messages: [
        {
          role: "system",
          text: systemText
        },
        {
          role: "user",
          text: userText
        }
      ]
    };

    try {
      if (this.isTokenExpired()) {
        this.iamTokenResponse = await this.iamTokenProvider.getIamTokenRespone();
      }
      const response: AxiosResponse<YandexGPTResponse> = await axios.post(this.baseUrl,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.iamTokenResponse.iamToken}`,
            'x-folder-id': this.folderId,
            'Content-Type': 'application/json'
          }
        }
      );

      const resultText = response.data.result.alternatives[0]?.message.text.trim();
      return resultText;
    } catch (error) {
      console.error('Error making request to YandexGPT:', error);
      throw new Error('Failed to process request with YandexGPT');
    }
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}