const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(cors());
//verify jwt access middleware
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

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
        const tableWithBookingCollection = client.db('restaurantManagement').collection('tableWithBookingCollection');
        const cartCollection = client.db('restaurantManagement').collection('cartCollection');
        const orderCollection = client.db('restaurantManagement').collection('orderCollection');
        //All Get colleciton Api
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
        });
        //Get userRole form user collection
        app.get('/userRole/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email: email });
            res.send(result);
        });
        //Get Table information by post
        app.post('/tableInfo', verifyJWT, async (req, res) => {
            const bookingTime = req.body
            const result = await tableWithBookingCollection.find({ booking_list: { $not: { $elemMatch: { time: bookingTime.time } } } }, { "booking_list": { $elemMatch: { date: bookingTime.date } } }).toArray();
            res.send(result)
        });
        //get cart item
        app.get('/cartData/:email', verifyJWT, async (req, res) => {
            const result = await cartCollection.find({ email: req.params.email }).toArray();
            res.send(result)
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
        //Post table booking
        app.post('/reservedTable/:email/:id', verifyJWT, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) };
            const bookingData = req.body
            const options = { upsert: true }
            const result = await tableWithBookingCollection.updateOne(filter, { $push: { "booking_list": bookingData } }, options)
            res.send(result)
        });
        //post cart item
        app.post('/postCartItem/:email', verifyJWT, async (req, res) => {
            const cartData = req.body;
            const menuId = cartData.menuItemId;
            const findMenuItem = await cartCollection.findOne({ email: req.params.email, menuItemId: menuId })
            if (findMenuItem) {
                res.send("Already added")
            } else {
                const result = await cartCollection.insertOne(cartData);
                res.send(result);
            }
        });
        app.post('/placedOrder/:email', verifyJWT, async (req, res) => {
            const result = await orderCollection.insertOne(req.body);
            res.send(result)
        })
        //All delete action api
        app.delete('/removeCartItem/:email/:id', verifyJWT, async (req, res) => {
            const result = await cartCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result)
        });
        app.delete('/removeAllCartItem/:email', verifyJWT, async (req, res) => {
            const result = await cartCollection.deleteMany({ email: req.params.email });
            res.send(result)
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