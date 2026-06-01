const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// High-Fidelity Active Patch / Secure Mode toggle state
let securityMode = 'vulnerable';

// Database emulation
const DB = {
  // Stage 1 orders
  orders: {
    "1": {
      orderId: "1",
      customer: "Alice Smith",
      item: "Cyberpunk Edition Mechanical Keyboard",
      price: "$189.99",
      status: "Delivered",
      shippingAddress: "123 Neon Way, Sector 7, Neo-Tokyo"
    },
    "2": {
      orderId: "2",
      customer: "Bob Johnson",
      item: "Retro RGB Gaming Mouse",
      price: "$59.99",
      status: "In Transit",
      shippingAddress: "456 Grid Blvd, Sector 9, Neo-Tokyo"
    },
    "3": {
      orderId: "3",
      customer: "Administrator",
      item: "Root Privilege Access Token Key",
      price: "$0.00",
      status: "Secret Delivery Confirmed",
      shippingAddress: "FLAG{idor_direct_access_success}",
      notes: "CRITICAL: Do not expose this order ID to public endpoints. Keep safe."
    }
  },

  // Stage 2 documents & users
  stage2Users: [
    { username: "alice_developer", userId: "542a0fb1-78c2-4690-ba09-543dfdf30101" },
    { username: "bob_analyst", userId: "d3b07384-d113-4690-bc90-a54dfdf30ea3" },
    { username: "chief_compliance_officer", userId: "a1a8c3d4-28b9-4f90-bc22-cf8a0fe38711" }
  ],
  stage2Docs: {
    "542a0fb1-78c2-4690-ba09-543dfdf30101": { title: "Alice Dev Notes", content: "Remember to push docker registry keys to stage-3 branch." },
    "d3b07384-d113-4690-bc90-a54dfdf30ea3": { title: "Bob Connection Logs", content: "Weekly server access logs compiled successfully." },
    "a1a8c3d4-28b9-4f90-bc22-cf8a0fe38711": { title: "Confidential Compliance Directive", content: "COMPLIANCE SECURITY AUDIT CLEARANCE FLAG: FLAG{idor_uuid_leakage_medium}" }
  },

  // Stage 3 records
  stage3UserDocs: {
    "guest": {
      "invoice_101": "Standard Corporate Utility Invoice - Paid $200"
    },
    "admin": {
      "admin_invoice": "CONFIDENTIAL CORE ARCHIVE ACCESS KEY: FLAG{idor_nested_route_bypass_hard}"
    }
  },

  // Stage 4 accounts
  stage4Profiles: {
    "guest_user": { username: "guest_user", email: "guest@cybercorp.local", role: "guest", key: "GUEST_DUMMY_KEY" },
    "executive_admin": { username: "executive_admin", email: "executive_admin@cybercorp.local", role: "admin", key: "FLAG{idor_bola_mass_assignment_expert}" }
  }
};

// Stage 1 API (Kept exactly intact for verifier.js compatibility)
app.get('/api/order', (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing parameter 'id'." });

  // SECURE MODE Check
  if (securityMode === 'secure' && id === '3') {
    return res.status(403).json({ error: "Access denied. Order 3 belongs to the Administrator." });
  }

  const order = DB.orders[id];
  if (!order) return res.status(404).json({ error: "Order details not found." });
  res.json(order);
});

// Stage 2: IDOR with unpredictable IDs & directory harvest
app.get('/api/stage2/users', (req, res) => {
  if (securityMode === 'secure') {
    // In secure mode, public directories do not disclose private UUID identifiers
    const safeUsers = DB.stage2Users.map(u => ({ username: u.username }));
    return res.json({ users: safeUsers });
  }
  res.json({ users: DB.stage2Users });
});

app.get('/api/stage2/document', (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing parameter 'id'." });

  if (securityMode === 'secure') {
    // Validate authorization bounds
    if (id === 'a1a8c3d4-28b9-4f90-bc22-cf8a0fe38711') {
      return res.status(403).json({ error: "Access denied. You do not possess permissions to view this Compliance Directive." });
    }
  }

  const doc = DB.stage2Docs[id];
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.json(doc);
});

// Stage 3: Nested API Route Bypass
app.get('/api/stage3/orders/:docId', (req, res) => {
  res.status(403).json({ error: "Access denied. Administrative profile required." });
});

app.get('/api/stage3/users/:userId/invoices/:docId', (req, res) => {
  const { userId, docId } = req.params;
  
  if (securityMode === 'secure') {
    // In secure mode, check if the session owner matches the requested resource context owner
    if (userId !== 'admin' && docId.includes("admin")) {
      return res.status(403).json({ error: "Access denied. Cross-context authorization mismatch." });
    }
  }

  const searchSpace = docId.includes("admin") ? DB.stage3UserDocs["admin"] : DB.stage3UserDocs["guest"];
  const doc = searchSpace[docId];
  if (!doc) return res.status(404).json({ error: "Invoice document not found." });
  
  res.json({ success: true, owner: docId.includes("admin") ? "admin" : userId, content: doc });
});

// Stage 4: Profile Mass Assignment / BOLA
app.get('/api/stage4/profile/view', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing parameter 'userId'." });
  
  const profile = DB.stage4Profiles[userId];
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  
  res.json(profile);
});

app.post('/api/stage4/profile/update', (req, res) => {
  const { userId, email, role } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing parameter 'userId' in JSON payload." });
  
  if (securityMode === 'secure') {
    // Strict Object-Level checks: Block unauthorized updates on other profile indices
    if (userId !== 'guest_user') {
      return res.status(403).json({ error: "Access denied. You cannot modify other user profiles." });
    }
    // Block mass assignment parameter binding (only allow safe field updates)
    if (role !== undefined) {
      return res.status(400).json({ error: "Operation rejected. Modifications to role parameters are not allowed." });
    }
  }

  const profile = DB.stage4Profiles[userId];
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  
  if (email !== undefined) profile.email = email;
  if (role !== undefined) profile.role = role;
  
  res.json({ success: true, message: "Profile synchronized successfully.", profile });
});

// Security mode toggling endpoints
app.get('/api/settings/security-mode', (req, res) => {
  res.json({ securityMode });
});

app.post('/api/settings/security-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'secure' || mode === 'vulnerable') {
    securityMode = mode;
    res.json({ success: true, message: `Security mode toggled to ${mode}.`, securityMode });
  } else {
    res.status(400).json({ error: "Invalid security mode." });
  }
});

app.listen(PORT, () => {
  console.log(`Upgraded Multi-Stage IDOR Lab running on port ${PORT}`);
});
