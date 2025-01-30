import { HttpStatus } from "@nestjs/common";
import axios from "axios";
import { sha1 } from "js-sha1";
import config from "src/config";

export class AuthenticationService {

    public async authenticate(userName: string, password: string) {
  
      const hash = Buffer.from(sha1(password), 'hex');
      const hashBase64 = hash.toString('base64');
      let response: any;
      try {
        response = await axios.post('https://base.itplan.ru:7071/DO_Dev3/hs/api/auth',
          {
            userName: userName,
            passHash: hashBase64
          },
          {
            auth: {
              username: config.authDO.username,
              password: config.authDO.password
            }
          }
        )
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