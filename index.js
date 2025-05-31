const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const express = require('express');
const app = express();
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000;
const cors = require('cors')
require('dotenv').config();



// middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))
app.use(express.json());
app.use(cookieParser());


const logger = (req, res, next) => {
  console.log("Inside the logger middleware");
  next();
}

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token
  console.log('cookie in middleware', token);
  if(!token) {
    return res.status(401).send({message: "UnAuthorize access"})
  }
  
  // verify token
  jwt.verify(token, process.env.JWT_ACCEES_SECRET, (err, decoded) => {
    if(err) {
      return res.status(401).send({message: "UnAuthorize access"})
    }
    req.decoded = decoded;
    next();
  })
}




// add mongoDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nvanxw5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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


    const jobsCollections = client.db('carrerCodeJobHunting').collection('jobs')
    const applicationsCollection = client.db('carrerCodeJobHunting').collection('applications')


    // jwt token related api
    app.post("/jwt", async(req, res) => {
      const userData = req.body;
      const token = jwt.sign(userData, process.env.JWT_ACCEES_SECRET, {expiresIn: "1d"});

      // set token in the cookies
      res.cookie('token', token, {
        httpOnly: true,
        secure: false,
      })

      // res.send({token})
      res.send({success: true})
    })


    // get jobs data
    app.get("/jobs", async (req, res) => {

      const email = req.query.email;
      const query = {};
      if(email) {
        query.hr_email = email;
      }


      const cursor = jobsCollections.find(query);
      const result = await cursor.toArray();

      res.send(result);
    })

    // get a single jobs details
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollections.findOne(query);

      res.send(result);
    })

    // get applications job data
    app.get("/applications/job/:job_id", async(req, res) => {
      const job_id = req.params.job_id;
      const query = {id: job_id};
      const result = await applicationsCollection.find(query).toArray();
      res.send(result)
    })



    // add data in jobs
    app.post("/jobs", async(req, res) => {
      const newJob = req.body;
      const result  = await jobsCollections.insertOne(newJob);
      res.send(result)
    }) 

    // job applicants related api
    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application)
      res.send(result);
    })


    // update active status data
    app.patch("/applications/:id", async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          status: req.body.status
        }
      }
      const result = await applicationsCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })


    app.get('/applications', logger, verifyToken, async (req, res) => {
      const email = req.query.email;

      // console.log("Inside Application APIs", req.cookies);

      if(email !== req.decoded.email) {
        return res.status(403).send({message: "Forbidded Access"})
      }


      const query = {
        applicant: email
      }
      const result = await applicationsCollection.find(query).toArray()
      
      // bad way to aggregat data
      for (const application of result) {
        const jobId = application.id;
        const jobQuery = { _id: new ObjectId(jobId) };
        const job = await jobsCollections.findOne(jobQuery)

        application.company = job.company
        application.title = job.title
        application.company_logo = job.company_logo


      }


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


app.get("/", (req, res) => {
  res.send("Carrer Code Job hunter")
})

app.listen(port, () => {
  console.log(`My server port is ${port}`);
})