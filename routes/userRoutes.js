const express = require("express");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require('../middlewares/authMiddleware');
require("dotenv").config();

const router = express.Router();

const HASURA_GRAPHQL_ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

// Register a new user
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const response = await axios.post(
      HASURA_GRAPHQL_ENDPOINT,
      {
        query: `
          mutation($name: String!, $email: String!, $password: String!) {
            insert_users_one(object: {
              name: $name, 
              email: $email, 
              password: $password, 
              accounts: { 
                data: {} 
              }
            }) {
              id
              accounts {
                id
                balance
              }
            }
          }
        `,
        variables: { name, email, password: hashedPassword },
      },
      {
        headers: {
          "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
        },
      }
    );
    //console.log(response.data.data.insert_users_one);
    res.status(201).json(response.data.data.insert_users_one);
  } catch (error) {
    res.status(400).send("Error While Signup");
  }
});

// Login a user
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const response = await axios.post(
      HASURA_GRAPHQL_ENDPOINT,
      {
        query: `
          query($email: String!) {
            users(where: { email: { _eq: $email } }) {
              id
              password
            }
          }
        `,
        variables: { email },
      },
      {
        headers: {
          "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
        },
      }
    );

    const user = response.data.data.users[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send("Invalid email or password");
    }

    const token = jwt.sign(
        { id: user.id, "https://hasura.io/jwt/claims": {
           "x-hasura-allowed-roles": ["user"],
           "x-hasura-default-role": "user",
           "x-hasura-user-id": user.id
         } },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      
    res.json({ token });
  } catch (error) {
    res.status(400).send("Error logging in user");
  }
});

router.put("/", authMiddleware ,async (req, res) => {
    const { name, email, password} = req.body;
    const id = req.id;
    
    const hashedPassword = await bcrypt.hash(password, 10);

    //console.log(id);
  
    try {
      const response = await axios.post(
        HASURA_GRAPHQL_ENDPOINT,
        {
          query: `
            mutation($id: uuid!, $name: String, $email: String, $password: String) {
              update_users_by_pk(
                pk_columns: { id: $id },
                _set: { name: $name, email: $email, password: $password }
              ) {
                id
                name
                email
              }
            }
          `,
          variables: { id, name, email, password: hashedPassword },
        },
        {
          headers: {
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
            "x-hasura-role": "user",
            "x-hasura-user-id": id
          },
        }
      );
  
      res.json(response.data.data.update_users_by_pk);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).send("Error updating user");
    }
});
  

router.get("/bulk", authMiddleware ,async (req, res) => {

    const id = req.id;

    try {
      const response = await axios.post(
        HASURA_GRAPHQL_ENDPOINT,
        {
          query: `
            query {
              users {
                id
                name
                email
              }
            }
          `,
        },
        {
          headers: {
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
          },
        }
      );
  
      res.json(response.data.data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(400).send("Error fetching users");
    }
});
  

router.get("/user", authMiddleware ,async (req, res) => {

    const id = req.id;
  
    try {
      const response = await axios.post(
        HASURA_GRAPHQL_ENDPOINT,
        {
          query: `
            query($id: uuid!) {
              users_by_pk(id: $id) {
                id
                name
                email
                accounts {
                  balance
                }
              }
            }
          `,
          variables: { id },
        },
        {
          headers: {
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
            "x-hasura-role": "user",
            "x-hasura-user-id": id
          },
        }
      );
  
      if (!response.data.data.users_by_pk) {
        return res.status(404).send("User not found");
      }
  
      const user = response.data.data.users_by_pk;
      //console.log(user.accounts);
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        balance: user.accounts[0].balance
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(400).send("Error fetching user");
    }
  });


module.exports = router;
