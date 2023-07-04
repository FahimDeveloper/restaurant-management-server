const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(cors());

app.get('/', async (req, res) => {
    res.send('Restaurant Management Server running')
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uekolpg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const menuCollection = client.db('restaurantManagement').collection('menuCollection');
        const usersCollection = client.db('restaurantManagement').collection('usersCollection');
        //All Get Api
        //Get All menu collection
        app.get('/menuCollection', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result)
        });
        //Get jwt token by post
        app.post('/jwt', async (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
            res.send(token);
        })
        //All post Api
        //post new user on server
        app.post('/newUser', async (req, res) => {
            const userData = req.body;
            const findUser = await usersCollection.findOne({ email: userData.email });
            if (findUser) {
                res.send('The user already have')
            } else {
                const result = await usersCollection.insertOne(userData);
                res.send(result)
            }
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);