##  Submission for the **Arbitrum APAC Mini Hackathon**

This project is a **multichain payment orchestrator** operating across **Base**, **Polygon**, and **Arbitrum**.
It listens for **stablecoin payments** and leverages **Biconomy** and the **ERC-4337 protocol** to enable **smart wallet generation** and **gasless transactions**.

The system includes:

* Webhooks for real-time updates
* Transaction status tracking
* Merchant management
* API key–based authentication
* And much more

---

###  Setup Instructions

```bash
npm install --legacy-peer-deps
```

1. Duplicate the `.env.example` file and fill in your environment variables.
2. Start the application:

```bash
npm run start
npm run start:listener
```

3. Enjoy exploring the multichain orchestration in action
