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
        // await client.connect();
        const menuCollection = client.db('restaurantManagement').collection('menuCollection');
        const usersCollection = client.db('restaurantManagement').collection('usersCollection');
        const tableWithBookingCollection = client.db('restaurantManagement').collection('tableWithBookingCollection');
        const cartCollection = client.db('restaurantManagement').collection('cartCollection');
        const orderCollection = client.db('restaurantManagement').collection('orderCollection');
        const staffCollection = client.db('restaurantManagement').collection('staffCollection');
        //All Get colleciton Api
        //Get All menu collection
        app.get('/menuCollection', async (req, res) => {
            const result = await menuCollection.find().sort({ date: -1 }).toArray();
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
            const result = await tableWithBookingCollection.find({
                $or: [
                    { booking_list: { $not: { $elemMatch: { reservationDate: bookingTime.date } } } },
                    { booking_list: { $not: { $elemMatch: { time: bookingTime.time } } } }
                ]
            }).toArray();
            res.send(result)
        });
        //get cart item
        app.get('/cartData/:email', verifyJWT, async (req, res) => {
            const result = await cartCollection.find({ email: req.params.email }).toArray();
            res.send(result)
        });
        app.get('/orderedInfo/:email', async (req, res) => {
            const result = await orderCollection.find({ userEmail: req.params.email }).sort({ date: -1 }).toArray();
            res.send(result);
        });
        app.get('/tableReservationInfo/:email', verifyJWT, async (req, res) => {
            const userEmail = req.params.email;
            const userBookings = await tableWithBookingCollection.aggregate([
                {
                    $match: {
                        "booking_list.email": userEmail
                    }
                },
                {
                    $unwind: "$booking_list"
                },
                {
                    $match: {
                        "booking_list.email": userEmail
                    }
                },
                {
                    $project: {
                        _id: 0,
                        booking_list: 1
                    }
                }
            ]).toArray();
            res.send(userBookings);
        });
        app.get('/tableReservationInfoForAdmin/:email', verifyJWT, async (req, res) => {
            const result = await tableWithBookingCollection.aggregate([
                {
                    $project: {
                        table_name: 1,
                        bookingList: "$booking_list"
                    }
                },
                {
                    $unwind: "$bookingList"
                },
                {
                    $project: {
                        table_name: 1,
                        _id: "$bookingList._id",
                        reservationDate: "$bookingList.reservationDate",
                        bookingDate: "$bookingList.bookingDate",
                        guest: "$bookingList.person",
                        phone: '$bookingList.phone',
                        time: "$bookingList.time",
                        name: "$bookingList.name",
                        email: "$bookingList.email",
                        table_id: "$bookingList.table_id",
                        table_name: "$bookingList.table_name",
                        tableImage: "$bookingList.table_name",
                        status: "$bookingList.status",
                    }
                }
            ]).toArray();
            res.send(result)
        })
        app.get('/singleMenuItem/:email/:id', verifyJWT, async (req, res) => {
            const result = await menuCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });
        app.get('/allOrderCollection/:email/', verifyJWT, async (req, res) => {
            const result = await orderCollection.find().toArray();
            res.send(result);
        });
        app.get("/viewOrderInfo/:email/:id", verifyJWT, async (req, res) => {
            const findOrder = await orderCollection.findOne({ _id: new ObjectId(req.params.id) });
            const query = { _id: { $in: findOrder.orderedItems.map(id => new ObjectId(id)) } }
            const result = await menuCollection.find(query).toArray();
            res.send(result)
        });
        app.get('/staffCollection/:email', verifyJWT, async (req, res) => {
            const result = await staffCollection.find().toArray();
            res.send(result);
        });
        app.get('/singleStaffInfo/:email/:id', async (req, res) => {
            const result = await staffCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(result)
        });
        app.get('/orderStates/:email', verifyJWT, async (req, res) => {
            const pipeline = [
                {
                    $addFields: {
                        menuItemsObjectIds: {
                            $map: {
                                input: '$orderedItems',
                                as: 'itemId',
                                in: { $toObjectId: '$$itemId' }
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'menuCollection',
                        localField: 'menuItemsObjectIds',
                        foreignField: '_id',
                        as: 'menuItemsData'
                    }
                },
                {
                    $unwind: '$menuItemsData'
                },
                {
                    $group: {
                        _id: '$menuItemsData.category',
                        count: { $sum: 1 },
                        total: { $sum: '$menuItemsData.price' }
                    }
                },
                {
                    $project: {
                        category: '$_id',
                        count: 1,
                        total: { $round: ['$total', 2] },
                        _id: 0
                    }
                }
            ];
            const pipeline2 = [
                {
                    $addFields: {
                        menuItemsObjectIds: {
                            $map: {
                                input: "$orderedItems",
                                as: "itemId",
                                in: { $toObjectId: "$$itemId" }
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: "menuCollection",
                        localField: "menuItemsObjectIds",
                        foreignField: "_id",
                        as: "menuItemsData"
                    }
                },
                {
                    $unwind: "$menuItemsData"
                },
                {
                    $group: {
                        _id: {
                            item: "$menuItemsData.name",
                            category: "$menuItemsData.category"
                        },
                        count: { $sum: 1 },
                        total: { $sum: "$menuItemsData.price" },
                        full_dish: { $first: "$menuItemsData" } // Add this line
                    }
                },
                {
                    $sort: { count: -1 }
                },
                {
                    $limit: 1
                },
                {
                    $project: {
                        item: "$_id.item",
                        category: "$_id.category",
                        count: 1,
                        total: { $round: ["$total", 2] },
                        full_dish: 1, // Include full_dish field
                        _id: 0
                    }
                }
            ];
            const result1 = await orderCollection.aggregate(pipeline).toArray();
            const result2 = await orderCollection.aggregate(pipeline2).toArray();
            res.send({ orderStates: result1, bestDish: result2 });
        });
        app.get('/bestDish/:dishId', async (req, res) => {
            const result = await menuCollection.findOne({ _id: new ObjectId(req.params.dishId) })
            res.send(result);
        });
        app.get('/countOfUsersAndStaffs/:email', verifyJWT, async (req, res) => {
            const countUsers = await usersCollection.countDocuments();
            const countStaffs = await staffCollection.countDocuments();
            res.send({ countUsers, countStaffs })
            console.log({ countUsers, countStaffs })
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
        });
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
        });
        app.post('/addMenuItem/:email', verifyJWT, async (req, res) => {
            const result = await menuCollection.insertOne(req.body);
            res.send(result)
        });
        app.post('/addRestaurantStaff/:email', verifyJWT, async (req, res) => {
            const result = await staffCollection.insertOne(req.body);
            res.send(result);
        });
        app.put('/reservationStatus/:email/:id/:table_id', async (req, res) => {
            const { id, email, table_id } = req.params;
            const status = req.body.status;
            const result = await tableWithBookingCollection.updateOne(
                {
                    _id: new ObjectId(table_id),
                    "booking_list": {
                        $elemMatch: {
                            "_id": id,
                            "email": email
                        }
                    }
                },
                { $set: { "booking_list.$.status": status } }
            );
            res.send(result);
        });
        //All delete action api
        app.delete('/removeCartItem/:email/:id', verifyJWT, async (req, res) => {
            const result = await cartCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result)
        });
        app.delete('/removeAllCartItem/:email', verifyJWT, async (req, res) => {
            const result = await cartCollection.deleteMany({ email: req.params.email });
            res.send(result)
        });
        app.delete('/cancelOrder/:email/:id', verifyJWT, async (req, res) => {
            const result = await orderCollection.deleteOne({ userEmail: req.params.email, _id: new ObjectId(req.params.id) });
            res.send(result)
        });
        app.delete("/deleteMenuItem/:email/:id", verifyJWT, async (req, res) => {
            const result = await menuCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result)
        });
        app.delete('/deleteStaff/:email/:id', verifyJWT, async (req, res) => {
            const result = await staffCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        })
        //All update api
        app.put("/updateMenuItem/:email/:id", verifyJWT, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    ...req.body
                }
            }
            const result = await menuCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        });
        app.put('/changeStatus/:email/:id', verifyJWT, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    status: req.body.status
                }
            }
            const result = await orderCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        });
        app.put('/updateStaffInfo/:email/:id', verifyJWT, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    ...req.body
                }
            }
            const result = await staffCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        });
        app.put('/quantityPlus/:email/:id', verifyJWT, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) }
            const findItem = await cartCollection.findOne(filter);
            if (findItem && findItem.quantity === 5) {
                return res.send('Quantity max')
            }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    quantity: req.body.quantity + 1
                }
            }
            const result = await cartCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });
        app.put('/quantityMinus/:email/:id', verifyJWT, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) }
            const findItem = await cartCollection.findOne(filter);
            if (findItem && findItem.quantity === 1) {
                return res.send('Quantity min')
            }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    quantity: req.body.quantity - 1
                }
            }
            const result = await cartCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);