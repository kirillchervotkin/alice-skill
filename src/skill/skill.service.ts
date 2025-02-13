import axios, { AxiosResponse } from "axios";
import config from "src/config";


export interface Task {
  id: string
  name: string,
  deadline?: string
}

export interface Stufftime {
  taskId: string
  userId: string
  workTypeId: string
  dateTime: Date
  countOfMinutes: string
  description: string
}

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

  public async getTaskByName(userId: string, name: string): Promise<Task> {
    let response: AxiosResponse = await axios.get(`${this.baseUrl}task?userId=${userId}&taskName=${name}`, {
      auth: this.auth
    });
    return response.data;
  }

  public async addStufftime(stufftime: Stufftime): Promise<void> {
    (stufftime as any).dateTime = stufftime.dateTime.toISOString().replace(/(\.\d{3})|[^\d]/g, '')
    let response: AxiosResponse = await axios.post(`${this.baseUrl}stufftime`, stufftime, {
      auth: this.auth
    });
    return response.data;
  }

}
}
