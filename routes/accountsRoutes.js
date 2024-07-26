const express = require("express");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require('../middlewares/authMiddleware');
require("dotenv").config();

const HASURA_GRAPHQL_ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;


const router = express.Router();

router.get("/balance", authMiddleware, async (req, res) => {
    
    try {
      const response = await axios.post(
        HASURA_GRAPHQL_ENDPOINT,
        {
          query: `
            query($id: uuid!) {
              accounts(where: { user_id: { _eq: $id } }) {
                balance
              }
            }
          `,
          variables: { id: req.id },
        },
        {
          headers: {
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
            "x-hasura-default-role": "user",
            "x-hasura-user-id": req.id
          },
        }
      );
  
      const account = response.data.data.accounts[0];
      if (!account) return res.status(404).send("Account not found.");
      res.json({ balance: account.balance });
    } catch (error) {
      res.status(400).send("Error fetching account balance");
    }
});


router.post("/transaction", authMiddleware, async (req, res) => {
    const { type, amount } = req.body;
  
    if (!["deposit", "withdraw"].includes(type)) {
      return res.status(400).send("Invalid transaction type.");
    }
  
    try {
      const balanceChange = type === "deposit" ? amount : -amount;

        const user = await axios.post(
          HASURA_GRAPHQL_ENDPOINT,
          {
            query: `
              query($id: uuid!) {
                users_by_pk(id: $id) {
                  accounts {
                    balance
                  }
                }
              }
            `,
            variables: { id: req.id },
          },
          {
            headers: {
              "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
              "x-hasura-role": "user",
              "x-hasura-user-id": req.id
            },
          }
        );

        const balance = user.data.data.users_by_pk.accounts[0].balance;

        if(type === "withdraw" && amount>balance){
          return res.status(400).send("Error performing transaction");
        }
  
      const response = await axios.post(
        HASURA_GRAPHQL_ENDPOINT,
        {
          query: `
            mutation($id: uuid!, $balanceChange: numeric!) {
              update_accounts(
                where: { user_id: { _eq: $id } }
                _inc: { balance: $balanceChange }
              ) {
                returning {
                  balance
                }
              }
            }
          `,
          variables: { id: req.id, balanceChange },
        },
        {
          headers: {
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
            "x-hasura-default-role": "user",
            "x-hasura-user-id": req.id
          },
        }
      );
  
      const updatedAccount = response.data.data.update_accounts.returning[0];
      if (!updatedAccount) return res.status(404).send("Account not found.");
      res.json({ balance: updatedAccount.balance });
    } catch (error) {
      res.status(400).send("Error performing transaction");
    }
});

module.exports = router;

