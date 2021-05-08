import mongoose, { Mongoose } from 'mongoose'
// import { Observable } from 'rxjs';
import { IUser, UserSchema } from './UserSchema';

const MongooseDBConnection = async (connectionString: string) => {

    const conn = await mongoose.connect(connectionString, { useNewUrlParser: true,useFindAndModify:false,
         useUnifiedTopology: true,poolSize:25,minSize:5,useCreateIndex:true })
        .catch((error) => {
            console.debug("Error in mongo connection using string {%s} is ", connectionString, error);
            return Promise.reject(false);
        });
    if (conn) {
        conn.connections.forEach(connection => {
            console.log("Mongo connected on port [%s] connection ID [%s]",connection.port,connection.id);
        });
        return Promise.resolve(true);
    }
};


export default MongooseDBConnection;