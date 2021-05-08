import mongoose from 'mongoose';


export interface IUserBase {
    email: string;
    fullName:string;
    city:string;
}

export interface IMoments{
    image:string;
    tags:Array<string>;
    title:string;
    time:Date;
    _id:mongoose.Types.ObjectId
}

export interface IUser extends IUserBase, mongoose.Document {
    email: string;
    password: string;
    moments:Array<IMoments>;
    fullName:string;
    city:string;
}

export const UserSchema = new mongoose.Schema({
    email: { type: String, required: true },
    password: { type: String, required: true },
    fullName:{type:String,required: true},
    city:{type:String,required:true},
    moments:{type:Array}
},{timestamps:{createdAt:true,updatedAt:true}});

export const UserModel = mongoose.model<IUser>("users", UserSchema, "users");