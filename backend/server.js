import express from "express";
import Razorpay from "razorpay";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// ------------------ MongoDB Setup ------------------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Create Order schema
const orderSchema = new mongoose.Schema(
  {
    razorpay_order_id: String,
    amount: Number,
    currency: String,
    status: { type: String, default: "created" },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

// ------------------ Razorpay Setup ------------------
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ------------------ Create Razorpay order endpoint ------------------
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;
    console.log("Amount received from frontend:", amount);

    const amountInRupees = Number(amount);
    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({ error: "Invalid amount received" });
    }

    const options = {
      amount: Math.round(amountInRupees * 100), // convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // ✅ Save order to MongoDB
    const newOrder = new Order({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
    });

    await newOrder.save();

    res.json(order);
  } catch (err) {
    console.error("Error creating Razorpay order:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------ Optional: fetch all orders ------------------
app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ Start server ------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
