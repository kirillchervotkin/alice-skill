import axios, { AxiosInstance, AxiosResponse } from "axios";
import config from "../config";
import { YandexGPT, YandexGPTInputs } from "@langchain/yandex/llms";
import { LLM } from "@langchain/core/language_models/llms";
import { CreateIamTokenResponse } from "@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/iam/v1/iam_token_service";
import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import * as jose from 'node-jose'
import { DocumentFlowClientIBSessionException } from "src/exceptions";
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

@Injectable()
export class DocumentFlowApiClient implements OnModuleDestroy {


  private client: AxiosInstance;

  constructor() {
    const jar = new CookieJar();
    this.client = wrapper(axios.create({ jar }));
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

  async onModuleDestroy() {
    await this.closeSession();
    console.log('session close');
  }

  public async closeSession() {

    try {

      let response = await this.client.get(`${this.baseUrl}tasks`, {
        auth: this.auth,
        headers: {
          IBSession: 'finish'
        }
      });
      return response.data;

    } catch (error) {

      if (error.response.data.includes(`Не указан заголовок управления сеансами или куки с идентификатором сеанса`)) {
        console.log('The session was not started');
      }
      throw error;
    }
  }


  private baseUrl: string = config.baseUrl;

  private auth: any = {
    username: config.authDO.username,
    password: config.authDO.password
  }

  public async checkOverdueTasks(userId: string) {
    try {

      let response = await this.client.get(`${this.baseUrl}checkOverdueTasks?userId=${userId}`, {
        auth: this.auth,
        headers: {
          IBSession: 'start'
        }
      });
      return response.data.result;

    } catch (error) {

      if (error.response.data.includes(`Не указан заголовок управления сеансами или куки с идентификатором сеанса`)) {
        throw new DocumentFlowClientIBSessionException(`IBSession header is not set`);
      } else {
        throw error;
      }
    }

  }

  public async getTasks(userId: string) {

    try {

      let response = await this.client.get(`${this.baseUrl}tasks?userId=${userId}`, {
        auth: this.auth,
        headers: {
          IBSession: 'start'
        }
      });
      return response.data;

    } catch (error) {

      if (error.response.data.includes(`Не указан заголовок управления сеансами или куки с идентификатором сеанса`)) {
        throw new DocumentFlowClientIBSessionException(`IBSession header is not set`);
      }
    }
  }

  public async getWorktypes(): Promise<Worktypes[]> {

    try {

      let response = await this.client.get(`${this.baseUrl}worktypes`, {
        auth: this.auth,
        headers: {
          IBSession: 'start'
        }
      });
      return response.data;

    } catch (error) {

      if (error.response.data.includes(`Не указан заголовок управления сеансами или куки с идентификатором сеанса`)) {
        throw new DocumentFlowClientIBSessionException(`IBSession header is not set`);
      } else {
        throw error;
      }

    }
  }

  public keepAlive() {
    this.client.get(`${this.baseUrl}tasks`, {
      auth: this.auth,
      headers: {
        IBSession: 'start'
      }
    });

  }

  public async getTaskByName(userId: string, name: string): Promise<Task> {
    let response: AxiosResponse = await this.client.get(`${this.baseUrl}task?userId=${userId}&taskName=${name}`, {
      auth: this.auth,
      headers: {
        IBSession: 'start'
      }
    });
    return response.data;
  }

  public async addStufftime(stufftime: Stufftime): Promise<void> {
    (stufftime as any).dateTime = this.formatDateToYYYYMMDDHHMMSS(stufftime.dateTime);
    let response: AxiosResponse = await this.client.post(`${this.baseUrl}stufftime`, stufftime, {
      auth: this.auth,
      headers: {
        IBSession: 'start'
      }
    });
    return response.data;
  }

  public async getProjectByName(name: string) {
    let response: AxiosResponse = await this.client.get(`${this.baseUrl}project?projectName=${name}`, {
      auth: this.auth,
      headers: {
        IBSession: 'start'
      }
    });
    return response.data;
  }

  public async getStafftimeByProjectId(projectId: string) {
    let response: AxiosResponse = await axios.get(`${this.baseUrl}stufftime?projectId=${projectId}`, {
      auth: this.auth,
      headers: {
        IBSession: 'start'
      }
    });
    return response.data;
  }

  public async getStafftimeTodayByUserId(userId: string) {
    let response: AxiosResponse = await axios.get(`${this.baseUrl}stufftime/?userId=${userId}`, {
      auth: this.auth,
      headers: {
        IBSession: 'start'
      }
    });
    return response.data;
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
  runEveryMinute() {
    try {
      this.documentFlowApiClient.keepAlive();
    } catch (error) {
      console.log(error);
    }
  }
}
