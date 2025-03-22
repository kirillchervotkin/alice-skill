import { HttpStatus } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { sha1 } from "js-sha1";
import config from "src/config";
import { CookieJar } from "tough-cookie";

export class AuthenticationService {

  private client: AxiosInstance;

  constructor() {
    const jar = new CookieJar();
    this.client = wrapper(axios.create({ jar }));
  }

  public async closeSession() {

    try {

      let response = await this.client.get(`https://base.itplan.ru:7071/DO/hs/api/tasks`, {
        auth: {
          username: config.authDO.username,
          password: config.authDO.password
        },
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

  public async authenticate(userName: string, password: string) {
    const shaPassword = sha1(password)

     const hash = Buffer.from(shaPassword, 'hex');
    const hashBase64 = hash.toString('base64');
    let response: any;
    try {
      response = await this.client.post('https://base.itplan.ru:7071/DO/hs/api/auth',
        {
          userName: userName,
          passHash: hashBase64
        },
        {
          auth: {
            username: config.authDO.username,
            password: config.authDO.password
          },
          headers: {
            IBSession: 'start'
          }
        }
      )
      this.closeSession();
    } catch (error) {
      if (error.response) {
        if (error.response.status == HttpStatus.NOT_FOUND) {
          return {
            error: "Пользователь с таким логином не найден"
          }
        };
        if (error.response.status == HttpStatus.UNPROCESSABLE_ENTITY) {
          return {
            error: "Неверный пароль"
          }
        }
      }
    }
    return { data: response.data };
  }
}