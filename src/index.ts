import { IUser, UserModel, IMoments } from './UserSchema';
import express, { request } from 'express';
import { Socket, ServerOptions } from 'socket.io';
import mongoose from 'mongoose'
import http from 'http';
import SocketIO from 'socket.io';
import md5 from 'md5'
import { CorsOptions } from 'cors';
import cors from 'cors';
import multer from 'multer';
import { decode } from 'jwt-simple';
import MongooseDBConnection from './MongoDBConnection';
import { unlinkSync } from 'fs';
export const secret = "2qazxe45tgbnjui89o";
const port: any = 4000;
const DBconnectionString = "mongodb://localhost:27017/Moments"
const host = "0.0.0.0";


const DIR = './public/uploads';

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, DIR);
    },
    filename: (req, file, callback) => {
        const fileName = file.originalname.toLowerCase().split(' ').join('-');
        callback(null, fileName)
    }
});

var upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter: (req, file, callback) => {
        if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg") {
            callback(null, true);
        } else {
            callback(null, false);
            return callback(new Error('Only .png, .jpg and .jpeg format allowed!'));
        }
    }
});


const options: CorsOptions = {
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'X-Access-Token'
    ],
    credentials: true,
    methods: 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
    origin: "*",
    preflightContinue: false,
};

const MongoConnected = MongooseDBConnection(DBconnectionString);


const app = express();
app.use(cors(options))
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: 1024 * 1024, type: "*" }));
app.use(express.static('public'))
const server = http.createServer(app);

app.get('/', (req, res) => {
    res.send(['Invalid Data']);
});
app.post('/uploadImage', upload.single('moment'), (req, res, next) => {
    const url = req.protocol + '://' + req.get('host')
    console.log("URL", url);
    // for (var i = 0; i < req.files.length; i++) {
    console.log("request body", req.body);
    console.log("request files", req.file);
    // const reqFile = url + '/public/uploads' + req.files[0].filename;
    var reqFile = url + '/uploads/' + req.file.filename;
    // }
    const tags: string[] = JSON.parse(req.body.tags);
    const title: string = req.body.title;
    const user: IUser = JSON.parse(req.body.user);

    UserModel.findOne({ email: user.email }, (err, doc: IUser) => {
        var moment: IMoments = {
            image: reqFile,
            tags: tags,
            title: title,
            _id: new mongoose.Types.ObjectId()
        };
        console.log("found user ", doc);
        const len = doc.moments?.length;
        if (len > 0)
            doc.moments.push(moment);
        else
            doc.moments = new Array<IMoments>(moment);
        doc.markModified("moments");
        doc.save().then(result => {
            console.log(result);
            res.status(201).json({
                message: "Done upload!",
                momentCreated: {
                    moment: result.moments
                }
            })
        }).catch(err => {
            console.log(err),
                res.status(500).json({
                    error: err
                });
        })
    });

})
app.post("/registerCheck", async (req, res, next) => {
    console.log("Registrey check : ", req.body);
    var response = { message: "email available", success: true }

    var client = await UserModel.findOne({ email: req.body.email }).catch(err => {
        console.debug("Unable to find user error occured ", err);
        next(err);
    });
    if (client) {
        console.log("cannot register as email is already used ", client)
        res.status(400).json({ error: "Email already in use." });
    }
    else {
        console.log("User not found so allow creation : ", client);
        res.send(response);
    }
});
app.post("/register", async (req, res) => {
    console.log("Register user : ", req.body);
    var user = req.body;
    if (user.password == user.confirmPassword) {
        var dbUser = new UserModel({
            email: user.email,
            password: md5(user.password),
            city: user.city,
            fullName: user.fullName
        });
        var dbUserSaved = await dbUser.save()
        if (dbUserSaved) {
            console.log("User created ", dbUserSaved);
            res.send(dbUserSaved);
        }
        else {
            res.status(500).json({ error: "User account could not be created! contact @ rahul.mitra@rahulmitra.dev" });
        }
    }
    else {
        res.status(400).json({ error: "Password and Confirm password are different!" });
    }
});

app.post("/login", async (req, res) => {
    console.log("Login request :", req.body);
    var user = req.body;
    user.password = md5(user.password);
    var response = { message: "user validated", success: true, user: null }
    var errorresponse = { message: "incorrect details", success: false }
    var client = await UserModel.findOne({ email: user.email, password: user.password }).catch(err => {
        console.debug("Unable to find user error occured ", err);
    });
    console.log("Login user data found is ", client)
    if (client) {
        client.moments = [];
        response.user = client;
        res.send(response);
    }
    else {
        res.status(403).json(errorresponse);
    }
});


app.post("/getMoments", async (req, res) => {
    let user = req.body;
    UserModel.findOne({ email: user.email }, (err, doc: IUser) => {
        if (!err) {
            if (doc) {
                res.send(doc.moments);
            }
            else {
                res.status(404).json({ error: "No Moments found" });
            }
        }
        else {
            res.status(500).json({ error: err });
        }

    });
});

app.post("/deleteMoment", async (req, res) => {
    console.log("deleting moment", req.body);
    let user = req.body.user;
    let momentTodelete = req.body.moment;
    UserModel.findOne({ email: user.email }, async (err, doc: IUser) => {
        if (!err) {
            if (doc) {
                var dbMoment = doc.moments.filter(m => { m._id == momentTodelete._id })[0];
                doc.moments.splice(doc.moments.indexOf(dbMoment), 1);
                doc.markModified('moments');
                var dbRes = await doc.save();
                if (dbRes) {
                    var absolutePath = momentTodelete.image.split("/").splice(3).join("/");
                    absolutePath = "./public/" + absolutePath;
                    console.log("path of file to delete", absolutePath)
                    unlinkSync(absolutePath);
                    console.log("path of file to delete", absolutePath, " -- Deleted")
                    res.send({ message: "moment deleted", moments: doc.moments });
                }
            }
            else {
                res.status(404).json({ error: "No Moments found" });
            }
        }
        else {
            res.status(500).json({ error: err });
        }

    });
});

app.post("/updateMomentWithoutImage", async (req, res) => {
    console.log("updating moment", req.body);
    let user = req.body.user;
    let MomentToUpdate = req.body.moment;
    let newMomentToUpdate = req.body.momentNew;
    UserModel.findOne({ email: user.email }, async (err, doc: IUser) => {
        if (!err) {
            if (doc) {
                var dbMomentToUpdate;
                for (const moment of doc.moments) {
                    // console.log("moment ",moment);
                    if (moment._id == MomentToUpdate._id) {
                        // console.log("moment found ",moment);
                        dbMomentToUpdate = moment;
                        break;
                    }
                }
                console.log("Moment found is ", dbMomentToUpdate);
                dbMomentToUpdate.tags = newMomentToUpdate.tags;
                dbMomentToUpdate.title = newMomentToUpdate.title;
                doc.markModified('moments');
                var dbRes = await doc.save();
                if (dbRes) {
                    res.send({ message: "moment updated", moments: doc.moments });
                }
            }
            else {
                res.status(404).json({ error: "No Moments found" });
            }
        }
        else {
            res.status(500).json({ error: err });
        }

    });
});

app.post("/updateMomentWithImage", upload.single('moment'), async (req, res) => {
    console.log("updating moment", req.body);
    const url = req.protocol + '://' + req.get('host')
    console.log("URL ", url);
    var reqFile = url + '/uploads/' + req.file.filename;
    let MomentToUpdate = JSON.parse(req.body.momentOld);
    let newMomentToUpdate = JSON.parse(req.body.momentNew);
    const user: IUser = JSON.parse(req.body.user);
    UserModel.findOne({ email: user.email }, async (err, doc: IUser) => {
        if (!err) {
            if (doc) {
                var dbMomentToUpdate;
                for (const moment of doc.moments) {
                    if (moment._id == MomentToUpdate._id) {
                        dbMomentToUpdate = moment;
                        break;
                    }
                }
                console.log("Moment found is ", dbMomentToUpdate);
                dbMomentToUpdate.tags = newMomentToUpdate.tags;
                dbMomentToUpdate.title = newMomentToUpdate.title;
                dbMomentToUpdate.image = reqFile;

                doc.markModified('moments');
                var dbRes = await doc.save();
                if (dbRes) {
                    var absolutePath = MomentToUpdate.image.split("/").splice(3).join("/");
                    absolutePath = "./public/" + absolutePath;
                    console.log("path of file to delete", absolutePath)
                    unlinkSync(absolutePath);
                    res.status(201).json({ message: "Moment updated!", momentCreated: { moment: doc.moments } });
                }
            }
            else {
                res.status(404).json({ error: "No Moments found" });
            }
        }
        else {
            res.status(500).json({ error: err });
        }

    });
});


server.listen(process.env.PORT || port, () => {

    console.log(`server is listening on port ${port}`);
});