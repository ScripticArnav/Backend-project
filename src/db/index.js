import mongoose from "mongoose"
import { DB_NAME } from "../constants.js";


const connectDB = async () => {
    // DB is in another continent.
    try {
        const connetionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB connected !! DB HOST: ${connetionInstance.connection.host}`);
        // console.log(connetionInstance);
    } catch (error) {
        console.log("MONGO DB connection Failed bhaiya lawde lag gaye", error);
        process.exit(1)
    }
}

export default connectDB;