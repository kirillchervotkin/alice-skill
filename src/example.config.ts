interface Config {
   port: number,
   hostname: string,
   authDO: {
      username: string
      password: string
   },
   clientId: string
   clientSecret: string
}

const config: Config = {
   port: 3000,
   hostname: "0.0.0.0",
   authDO: {
      username: "userName",
      password: "password"
   },
   clientId : 'clientId',
   clientSecret : 'clientSecret'
}

export default config;