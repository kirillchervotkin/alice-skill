import axios from "axios";
import config from "src/config";


export class DocumentFlowApiClient {

    public async getTasks(userId: string) {
  
      let response = await axios.get(`https://base.itplan.ru:7071/DO_Dev3/hs/api/tasks?userId=${userId}`, {
        auth: {
          username: config.authDO.username,
          password: config.authDO.password
        }
      });
      return response.data;
    }
  }