import axios, { AxiosResponse } from "axios";
import config from "src/config";


export class DocumentFlowApiClient {

  private baseUrl: string = 'https://base.itplan.ru:7071/DO_Dev3/hs/api/'

  private auth: any = {
    username: config.authDO.username,
    password: config.authDO.password
  }

  public async getTasks(userId: string) {

    let response = await axios.get(`${this.baseUrl}tasks?userId=${userId}`, {
      auth: this.auth
    });
    return response.data;
  }

}
