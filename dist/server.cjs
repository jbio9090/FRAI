"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_genai = require("@google/genai");
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_express = __toESM(require("express"), 1);
var import_vite = require("vite");
var users = [
  {
    id: 1,
    name: "GSO Administrator",
    email: "gso@example.com",
    role: "Super Admin",
    roles: ["Super Admin"],
    permissions: [
      "view requests",
      "create requests",
      "approve requests",
      "reject requests",
      "manage facilities",
      "manage equipments",
      "manage users",
      "modify rules",
      "view chatbot logs",
      "reset password",
      "create new admins",
      "manage request options"
    ],
    is_active: true,
    avatar: null,
    created_at: "2025-01-01T00:00:00Z"
  },
  {
    id: 2,
    name: "Dean Eleanor Vance",
    email: "admin@example.com",
    role: "admin",
    roles: ["admin"],
    permissions: [
      "view requests",
      "create requests",
      "approve requests",
      "reject requests",
      "manage facilities",
      "manage equipments",
      "manage users",
      "modify rules",
      "view chatbot logs",
      "manage request options"
    ],
    is_active: true,
    avatar: null,
    created_at: "2025-01-05T00:00:00Z"
  },
  {
    id: 3,
    name: "Prof. Marcus Brody",
    email: "user@example.com",
    role: "Department Head",
    roles: ["Department Head"],
    permissions: ["view requests", "create requests"],
    is_active: true,
    avatar: null,
    created_at: "2025-01-10T00:00:00Z"
  }
];
var campuses = [
  { id: 1, name: "Main Campus" },
  { id: 2, name: "Annes Campus" },
  { id: 3, name: "SIPAG Campus" }
];
var buildings = [
  { id: 1, campus_id: 1, name: "Student Building" },
  { id: 2, campus_id: 1, name: "College of Education" },
  { id: 3, campus_id: 1, name: "College of Engineering & IT" },
  { id: 4, campus_id: 1, name: "CABA Building" }
];
var equipments = [
  { id: 1, name: "Padded Seats", total_quantity: 500 },
  { id: 2, name: "Built-in Sound System", total_quantity: 4 },
  { id: 3, name: "Motorized HD Projector", total_quantity: 6 },
  { id: 4, name: "Tables for Laptop & AV", total_quantity: 20 },
  { id: 5, name: "Wireless Microphones", total_quantity: 12 },
  { id: 6, name: "Mic Stands", total_quantity: 10 },
  { id: 7, name: "Podium w/ University Seal", total_quantity: 3 },
  { id: 8, name: "Folding Banquet Tables", total_quantity: 30 },
  { id: 9, name: "Monoblock Chairs", total_quantity: 800 },
  { id: 10, name: "High-Definition LED Video Wall (9x12ft)", total_quantity: 2 },
  { id: 11, name: "Mobile Fender PA System", total_quantity: 4 },
  { id: 12, name: "Tarpaulin Backdrop Frame (8x12ft)", total_quantity: 4 }
];
var facilities = [
  {
    id: 1,
    building_id: 1,
    name: "University Main Auditorium",
    capacity: 500,
    description: "Large theater-style auditorium equipped with stage lighting, acoustic treatment, and motorized projector system.",
    building: buildings[0],
    equipments: [equipments[0], equipments[1], equipments[2], equipments[4], equipments[6]]
  },
  {
    id: 2,
    building_id: 2,
    name: "College Assembly Hall",
    capacity: 800,
    description: "Multi-purpose indoor grand hall suitable for university ceremonies, convocations, and major symposiums.",
    building: buildings[1],
    equipments: [equipments[8], equipments[1], equipments[2], equipments[9], equipments[4]]
  },
  {
    id: 3,
    building_id: 2,
    name: "COED Audio-Visual Room (AVR)",
    capacity: 100,
    description: "Stepped seating audiovisual room for faculty seminars, thesis presentations, and guest lectures.",
    building: buildings[1],
    equipments: [equipments[2], equipments[1], equipments[3], equipments[4]]
  },
  {
    id: 4,
    building_id: 3,
    name: "CEIT Lecture Hall",
    capacity: 160,
    description: "Tiered academic lecture theater with individual student workstation power outlets and dual HD displays.",
    building: buildings[2],
    equipments: [equipments[2], equipments[1], equipments[4], equipments[5]]
  },
  {
    id: 5,
    building_id: 3,
    name: "Multi-Purpose Hall 6C (North)",
    capacity: 300,
    description: "Spacious collaborative hall on the 6th floor for workshops, hackathons, and technology symposiums.",
    building: buildings[2],
    equipments: [equipments[7], equipments[8], equipments[10], equipments[4]]
  },
  {
    id: 6,
    building_id: 3,
    name: "Multi-Purpose Hall 6D (South)",
    capacity: 50,
    description: "Conference-style seminar room for focus groups, departmental workshops, and committee meetings.",
    building: buildings[2],
    equipments: [equipments[3], equipments[2], equipments[4]]
  },
  {
    id: 7,
    building_id: 4,
    name: "CABA Executive Lecture Hall",
    capacity: 100,
    description: "Business school executive auditorium featuring ergonomic seating and teleconferencing capabilities.",
    building: buildings[3],
    equipments: [equipments[2], equipments[1], equipments[4], equipments[6]]
  },
  {
    id: 8,
    building_id: 4,
    name: "Multi-Purpose Hall 6A",
    capacity: 300,
    description: "Air-conditioned hall with flexible seating configurations for enterprise exhibitions and student fairs.",
    building: buildings[3],
    equipments: [equipments[7], equipments[8], equipments[1], equipments[4]]
  }
];
var rules = [
  {
    id: 1,
    title: "Advance Notice Requirement",
    content: "All facility reservation requests must be submitted at least 5 working days prior to the event date to ensure operational readiness, staff scheduling, and conflict reviews.",
    forPolicy: 0,
    order: 1,
    category: "Booking Policy"
  },
  {
    id: 2,
    title: "Authorized University Purpose",
    content: "Facilities are reserved primarily for accredited academic curricula, college-sanctioned student organization activities, and official university administrative programs.",
    forPolicy: 0,
    order: 2,
    category: "Usage Guidelines"
  },
  {
    id: 3,
    title: "Clean As You Go (CLAYGO) Standard",
    content: "Organizers and attendees must strictly maintain facility cleanliness. All temporary decors, tarpaulins, and refuse must be cleared immediately upon conclusion of the reserved slot.",
    forPolicy: 0,
    order: 3,
    category: "Facility Care"
  },
  {
    id: 4,
    title: "Equipment Accountability and Custody",
    content: "Borrowed audio-visual systems, microphones, and peripherals remain under the accountable custody of the requesting department head and must be returned intact immediately following the session.",
    forPolicy: 0,
    order: 4,
    category: "Equipment Policy"
  },
  {
    id: 5,
    title: "Cancellation & Reschedule Protocol",
    content: "Rescheduling or cancellation requests should be posted at least 24 hours in advance to release the reserved timeslot back into the availability pool for other colleges.",
    forPolicy: 0,
    order: 5,
    category: "Booking Policy"
  },
  // FAQs (forPolicy: 1)
  {
    id: 6,
    title: "How far in advance should I submit a facility request?",
    content: "Requests must be submitted at least 5 working days prior to your planned event date to allow sufficient time for administrative approval, equipment allocation, and conflict checks.",
    forPolicy: 1,
    order: 1,
    category: "General"
  },
  {
    id: 7,
    title: "Can I book multiple facilities in a single request form?",
    content: "Yes! The FRAI booking workflow allows you to add multiple facilities, dates, and dedicated equipment lists within a unified reservation submission.",
    forPolicy: 1,
    order: 2,
    category: "Reservation"
  },
  {
    id: 8,
    title: "How does the AI recommendation feature assist with scheduling conflicts?",
    content: "When an overlapping booking occurs or a facility is over-capacity, the FRAI AI engine analyzes building schedules, nearby open dates, alternative halls with matching seating capacity, and available equipment to recommend optimized alternative slots.",
    forPolicy: 1,
    order: 3,
    category: "AI Features"
  },
  {
    id: 9,
    title: "Who is required to approve facility reservation requests?",
    content: "Standard workflows route through Department Heads, College Deans, Office of Student Affairs (OSA), and the General Services Office (GSO) for final facility handover.",
    forPolicy: 1,
    order: 4,
    category: "Approvals"
  }
];
var settingsData = {
  approvers: ["Faculty Adviser", "Department Head", "College Dean", "OSA Director", "VP Academic Affairs", "GSO Administrator"],
  booking_window: {
    start_time: "07:00",
    end_time: "21:00",
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    step_minutes: 30
  },
  min_advance_days: 5,
  admin_email_notifications_enabled: true
};
var auditLogs = [
  {
    id: 1,
    request_id: 1,
    user_id: 1,
    user: users[0],
    event: "Request Created",
    description: "Initial booking request submitted for Annual Technology Hackathon 2025.",
    created_at: new Date(Date.now() - 864e5 * 3).toISOString()
  },
  {
    id: 2,
    request_id: 1,
    user_id: 1,
    user: users[0],
    event: "AI Recommendation Generated",
    description: "AI analyzed schedule and validated capacity fit with 0 detected equipment conflicts.",
    created_at: new Date(Date.now() - 864e5 * 3 + 1e4).toISOString()
  },
  {
    id: 3,
    request_id: 2,
    user_id: 2,
    user: users[1],
    event: "Request Approved",
    description: "Approved by Dean Eleanor Vance with condition of early AV testing.",
    created_at: new Date(Date.now() - 864e5 * 2).toISOString()
  }
];
var chatbotLogs = [
  {
    id: 1,
    session_id: "session-demo-01",
    user_id: 3,
    user: users[2],
    message: "What is the maximum seating capacity of the Main Auditorium?",
    response: "The University Main Auditorium accommodates up to 500 attendees. It features stage lighting, an acoustic setup, and a motorized HD projection system.",
    matched_rule_id: 1,
    feedback: "helpful",
    created_at: new Date(Date.now() - 36e5 * 4).toISOString()
  },
  {
    id: 2,
    session_id: "session-demo-01",
    user_id: 3,
    user: users[2],
    message: "How early do I need to book for next semester symposium?",
    response: "According to university guidelines, booking requests must be submitted at least 5 working days in advance.",
    matched_rule_id: 6,
    feedback: "helpful",
    created_at: new Date(Date.now() - 36e5 * 3).toISOString()
  }
];
var today = /* @__PURE__ */ new Date();
var formatDate = (offsetDays) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
};
var requests = [
  {
    id: 1,
    title: "Annual University Innovation & Tech Hackathon",
    purpose: "Three-day collegiate innovation sprint bringing together student software engineers, designers, and industry mentors.",
    priority_level: 2,
    status: "Pending",
    on_hold: false,
    recommended_action: "Approved",
    recommendation_reason: "Schedule is clear with zero conflicts and high capacity matching across selected halls.",
    user_id: 3,
    user: users[2],
    approvers: [
      { name: "Department Head", status: "Approved" },
      { name: "College Dean", status: "Pending" },
      { name: "OSA Director", status: "Pending" },
      { name: "GSO Administrator", status: "Pending" }
    ],
    facilities: [
      {
        id: 101,
        request_id: 1,
        facility_id: 1,
        facility: facilities[0],
        event_date: formatDate(7),
        start_time: "08:00:00",
        end_time: "18:00:00",
        equipments: [
          { id: 1, equipment_id: 1, quantity: 450, equipment: equipments[0] },
          { id: 2, equipment_id: 2, quantity: 1, equipment: equipments[1] },
          { id: 3, equipment_id: 5, quantity: 4, equipment: equipments[4] }
        ]
      },
      {
        id: 102,
        request_id: 1,
        facility_id: 5,
        facility: facilities[4],
        event_date: formatDate(8),
        start_time: "09:00:00",
        end_time: "17:00:00",
        equipments: [
          { id: 4, equipment_id: 7, quantity: 15, equipment: equipments[7] },
          { id: 5, equipment_id: 8, quantity: 150, equipment: equipments[8] }
        ]
      }
    ],
    comments: [
      {
        id: 1,
        request_id: 1,
        user_id: 1,
        user: users[0],
        comment: "Please ensure university electricians are notified for power drop setups.",
        created_at: new Date(Date.now() - 36e5 * 20).toISOString()
      }
    ],
    files: [
      { id: 1, name: "Hackathon_Event_Matrix_2025.pdf", url: "#", size: "1.4 MB" },
      { id: 2, name: "Safety_And_Security_Endorsement.pdf", url: "#", size: "680 KB" }
    ],
    created_at: new Date(Date.now() - 864e5 * 2).toISOString(),
    updated_at: new Date(Date.now() - 864e5 * 1).toISOString()
  },
  {
    id: 2,
    title: "College of Education Recognition Rites",
    purpose: "Honor student commendations, dean\u2019s lister recognitions, and pre-service teacher pinning ceremony.",
    priority_level: 1,
    status: "Approved",
    on_hold: false,
    recommended_action: "Approved",
    recommendation_reason: "Facility capacity meets required headcount and all equipment inventory is readily assigned.",
    user_id: 2,
    user: users[1],
    approvers: [
      { name: "Department Head", status: "Approved" },
      { name: "College Dean", status: "Approved" },
      { name: "OSA Director", status: "Approved" },
      { name: "GSO Administrator", status: "Approved" }
    ],
    facilities: [
      {
        id: 103,
        request_id: 2,
        facility_id: 2,
        facility: facilities[1],
        event_date: formatDate(10),
        start_time: "13:00:00",
        end_time: "17:00:00",
        equipments: [
          { id: 6, equipment_id: 8, quantity: 600, equipment: equipments[8] },
          { id: 7, equipment_id: 6, quantity: 1, equipment: equipments[6] },
          { id: 8, equipment_id: 9, quantity: 1, equipment: equipments[9] }
        ]
      }
    ],
    comments: [
      {
        id: 2,
        request_id: 2,
        user_id: 2,
        user: users[1],
        comment: "Rehearsal scheduled 2 hours prior to start.",
        created_at: new Date(Date.now() - 864e5).toISOString()
      }
    ],
    files: [
      { id: 3, name: "Recognition_Program_Flow.pdf", url: "#", size: "820 KB" }
    ],
    created_at: new Date(Date.now() - 864e5 * 4).toISOString(),
    updated_at: new Date(Date.now() - 864e5 * 2).toISOString()
  },
  {
    id: 3,
    title: "CABA Leadership Masterclass & Case Competition",
    purpose: "Executive speaker series and business model challenge with university corporate partners.",
    priority_level: 1,
    status: "For Reschedule",
    on_hold: false,
    recommended_action: "Reschedule",
    recommendation_reason: "Requested date overlaps with university maintenance schedule on CABA Lecture Hall.",
    user_id: 3,
    user: users[2],
    approvers: [
      { name: "Department Head", status: "Approved" },
      { name: "College Dean", status: "Rejected" },
      { name: "OSA Director", status: "Pending" }
    ],
    facilities: [
      {
        id: 104,
        request_id: 3,
        facility_id: 7,
        facility: facilities[6],
        event_date: formatDate(5),
        start_time: "10:00:00",
        end_time: "15:00:00",
        equipments: [
          { id: 9, equipment_id: 2, quantity: 1, equipment: equipments[2] }
        ]
      }
    ],
    comments: [
      {
        id: 3,
        request_id: 3,
        user_id: 1,
        user: users[0],
        comment: "Please check the AI recommendation tab for alternative slots next Tuesday or Thursday.",
        created_at: new Date(Date.now() - 36e5 * 5).toISOString()
      }
    ],
    files: [],
    created_at: new Date(Date.now() - 864e5 * 1).toISOString(),
    updated_at: new Date(Date.now() - 36e5 * 5).toISOString()
  }
];
var currentUserId = 1;
var viteDevServer = null;
function getCurrentUser() {
  return users.find((u) => u.id === currentUserId) || users[0];
}
async function renderInertia(req, res, component, props, flash) {
  const user = getCurrentUser();
  const sharedData = {
    name: "FRAI",
    page_title: props.page_title || "FRAI",
    breadcrumbs: props.breadcrumbs || [{ title: "Home", url: "/" }],
    labeledBreadcrumb: props.labeledBreadcrumb,
    auth: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles,
        permissions: user.permissions,
        is_active: user.is_active,
        avatar: user.avatar
      }
    },
    userRoles: user.roles,
    userPermissions: user.permissions,
    isSuperAdmin: user.role === "Super Admin",
    canApprove: user.permissions.includes("approve requests"),
    canCreate: user.permissions.includes("create requests"),
    canManageFacilities: user.permissions.includes("manage facilities"),
    flash: flash || {},
    firebaseConfig: {
      apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyMockKeyForPreview",
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "frai-preview.firebaseapp.com",
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "frai-preview",
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "frai-preview.appspot.com",
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
      appId: process.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
    },
    ...props
  };
  const inertiaObject = {
    component,
    props: sharedData,
    url: req.originalUrl || req.url,
    version: ""
  };
  if (req.headers["x-inertia"]) {
    res.setHeader("X-Inertia", "true");
    res.setHeader("Vary", "Accept");
    return res.json(inertiaObject);
  }
  const indexPath = import_path.default.join(process.cwd(), "index.html");
  if (import_fs.default.existsSync(indexPath)) {
    let html = import_fs.default.readFileSync(indexPath, "utf8");
    const jsonSafe = JSON.stringify(inertiaObject).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
    html = html.replace(/data-page='[^']*'/, `data-page='${jsonSafe}'`);
    if (viteDevServer) {
      try {
        html = await viteDevServer.transformIndexHtml(req.originalUrl || req.url, html);
      } catch (err) {
        console.error("Error transforming index.html with Vite:", err);
      }
      const reactRefreshPreamble = `
    <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
    </script>`;
      if (!html.includes("__vite_plugin_react_preamble_installed__")) {
        html = html.replace("</head>", `${reactRefreshPreamble}
</head>`);
      }
    }
    return res.send(html);
  }
  res.json(inertiaObject);
}
var genAIClient = null;
function getGenAI() {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new import_genai.GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAIClient;
}
var activeChatSessions = /* @__PURE__ */ new Map();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use(import_express.default.urlencoded({ extended: true }));
  app.use((0, import_cookie_parser.default)());
  app.use(import_express.default.static(import_path.default.join(process.cwd(), "public")));
  app.post("/api/switch-user", (req, res) => {
    const { userId } = req.body;
    const target = users.find((u) => u.id === Number(userId));
    if (target) {
      currentUserId = target.id;
      return res.json({ success: true, user: target });
    }
    res.status(400).json({ error: "User not found" });
  });
  app.get("/login", (req, res) => {
    renderInertia(req, res, "login", {
      page_title: "Login to FRAI",
      canResetPassword: true,
      status: null
    });
  });
  app.post("/login", (req, res) => {
    const { email } = req.body;
    const user = users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
    if (user) {
      currentUserId = user.id;
      if (req.headers["x-inertia"]) {
        res.setHeader("X-Inertia-Location", "/dashboard");
        return res.status(303).redirect("/dashboard");
      }
      return res.redirect("/dashboard");
    }
    currentUserId = 1;
    if (req.headers["x-inertia"]) {
      res.setHeader("X-Inertia-Location", "/dashboard");
      return res.status(303).redirect("/dashboard");
    }
    res.redirect("/dashboard");
  });
  app.post("/logout", (req, res) => {
    currentUserId = 1;
    if (req.headers["x-inertia"]) {
      res.setHeader("X-Inertia-Location", "/login");
      return res.status(303).redirect("/login");
    }
    res.redirect("/login");
  });
  app.get("/", (req, res) => {
    res.redirect("/dashboard");
  });
  app.get("/dashboard", (req, res) => {
    const total = requests.length;
    const pendingList = requests.filter((r) => r.status === "Pending");
    const approvedList = requests.filter((r) => r.status === "Approved");
    const rejectedList = requests.filter((r) => r.status === "Rejected");
    const initialEvents = requests.flatMap(
      (reqItem) => reqItem.facilities.map((f) => ({
        id: f.id,
        title: `${reqItem.title} (${f.facility?.name || "Facility"})`,
        start: /* @__PURE__ */ new Date(`${f.event_date}T${f.start_time}`),
        end: /* @__PURE__ */ new Date(`${f.event_date}T${f.end_time}`),
        request_id: reqItem.id,
        building: f.facility?.building?.name || "Main Campus"
      }))
    );
    const uniqueBuildings = Array.from(
      new Set(facilities.map((f) => f.building?.name).filter(Boolean))
    );
    const auditEventsList = [
      { value: "all", label: "All Events" },
      { value: "Request Created", label: "Request Created" },
      { value: "Approved", label: "Approved" },
      { value: "Status Change", label: "Status Change" },
      { value: "Comment Added", label: "Comment Added" }
    ];
    const breakdownMap = {};
    auditLogs.forEach((log) => {
      breakdownMap[log.event] = (breakdownMap[log.event] || 0) + 1;
    });
    const breakdown = Object.entries(breakdownMap).map(([event, count]) => ({
      event,
      label: event,
      count
    }));
    const now = /* @__PURE__ */ new Date();
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 864e5);
      const dateStr = d.toISOString().split("T")[0];
      const count = requests.filter((r) => r.created_at && r.created_at.startsWith(dateStr)).length;
      return {
        date: dateStr,
        total: count > 0 ? count : i % 2 === 0 ? 3 : 5
      };
    });
    renderInertia(req, res, "dashboard", {
      page_title: "Dashboard",
      breadcrumbs: [{ title: "Dashboard", url: "/dashboard" }],
      pending: {
        data: pendingList
      },
      initialEvents,
      buildings: uniqueBuildings.length > 0 ? uniqueBuildings : ["Student Building", "College of Education", "College of Engineering & IT", "CABA Building"],
      auditLogs: {
        data: auditLogs,
        current_page: 1,
        last_page: 1,
        total: auditLogs.length
      },
      auditEvents: auditEventsList,
      breakdown,
      chartData,
      notifications: [],
      kpis: {
        awaitingDecision: pendingList.length,
        needsAction: requests.filter((r) => r.status === "For Reschedule" || r.on_hold).length,
        approvedThisWeek: approvedList.length,
        eventsToday: 2
      },
      stats: {
        totalRequests: total,
        pendingRequests: pendingList.length,
        approvedRequests: approvedList.length,
        rejectedRequests: rejectedList.length
      },
      recentRequests: requests.slice(0, 5),
      facilities
    });
  });
  app.get("/dashboard/calendar", (req, res) => {
    const events = [];
    requests.forEach((reqItem) => {
      reqItem.facilities.forEach((f) => {
        events.push({
          id: `${reqItem.id}-${f.id}`,
          title: `${reqItem.title} (${f.facility?.name || "Facility"})`,
          start: `${f.event_date}T${f.start_time}`,
          end: `${f.event_date}T${f.end_time}`,
          status: reqItem.status,
          facilityId: f.facility_id,
          facilityName: f.facility?.name,
          requestId: reqItem.id,
          priority: reqItem.priority_level
        });
      });
    });
    res.json(events);
  });
  app.get("/dashboard/chart-data", (req, res) => {
    res.json({
      monthlyTrends: [
        { month: "Jan", requests: 12, approved: 10 },
        { month: "Feb", requests: 19, approved: 16 },
        { month: "Mar", requests: 25, approved: 22 },
        { month: "Apr", requests: 18, approved: 15 },
        { month: "May", requests: 30, approved: 27 },
        { month: "Jun", requests: 22, approved: 19 }
      ],
      facilityUsage: facilities.map((f) => ({
        name: f.name,
        count: requests.filter((r) => r.facilities.some((rf) => rf.facility_id === f.id)).length
      }))
    });
  });
  app.get("/dashboard/audit-logs", (req, res) => {
    res.json({
      data: auditLogs,
      current_page: 1,
      last_page: 1,
      total: auditLogs.length
    });
  });
  app.get("/dashboard/pending-requests", (req, res) => {
    const pending = requests.filter((r) => r.status === "Pending");
    res.json({
      data: pending,
      total: pending.length
    });
  });
  app.post("/dashboard/notifications/mark-read", (req, res) => {
    res.json({ success: true });
  });
  app.get("/requests", (req, res) => {
    const filter = req.query.filter || "all";
    const search = req.query.search || "";
    const facilityFilter = req.query.facility_id;
    let filtered = [...requests];
    if (filter === "pending") filtered = filtered.filter((r) => r.status === "Pending");
    if (filter === "approved") filtered = filtered.filter((r) => r.status === "Approved");
    if (filter === "rejected") filtered = filtered.filter((r) => r.status === "Rejected");
    if (filter === "reschedule") filtered = filtered.filter((r) => r.status === "For Reschedule");
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r) => r.title.toLowerCase().includes(q) || r.user.name.toLowerCase().includes(q));
    }
    if (facilityFilter) {
      const fid = Number(facilityFilter);
      filtered = filtered.filter((r) => r.facilities.some((f) => f.facility_id === fid));
    }
    renderInertia(req, res, "requests/index", {
      page_title: "Facility Requests",
      breadcrumbs: [{ title: "Requests", url: "/requests" }],
      requests: {
        data: filtered,
        links: [{ url: null, label: "&laquo; Previous", active: false }, { url: "/requests?page=1", label: "1", active: true }, { url: null, label: "Next &raquo;", active: false }],
        current_page: 1,
        last_page: 1,
        total: filtered.length
      },
      filter,
      facilities,
      requesters: users.map((u) => ({ id: u.id, name: u.name }))
    });
  });
  app.get("/requests/create", (req, res) => {
    renderInertia(req, res, "requests/create", {
      page_title: "Create Facility Request",
      breadcrumbs: [
        { title: "Requests", url: "/requests" },
        { title: "New Request", url: "/requests/create" }
      ],
      facilities,
      equipments,
      requestOptions: {
        approvers: settingsData.approvers,
        booking_window: settingsData.booking_window,
        min_advance_days: settingsData.min_advance_days
      },
      bookingWindow: settingsData.booking_window,
      minAdvanceDays: settingsData.min_advance_days
    });
  });
  app.post("/requests", (req, res) => {
    const { title, purpose, priority_level, facilities: reqFacilities } = req.body;
    const user = getCurrentUser();
    const newId = requests.length ? Math.max(...requests.map((r) => r.id)) + 1 : 1;
    const mappedFacilities = (reqFacilities || []).map((f, idx) => {
      const fullFacility = facilities.find((fac) => fac.id === Number(f.facility_id));
      return {
        id: newId * 100 + idx,
        request_id: newId,
        facility_id: Number(f.facility_id),
        facility: fullFacility,
        event_date: f.event_date,
        start_time: f.start_time,
        end_time: f.end_time,
        equipments: (f.equipments || []).map((eq, eqIdx) => ({
          id: newId * 1e3 + eqIdx,
          equipment_id: Number(eq.equipment_id),
          quantity: Number(eq.quantity),
          equipment: equipments.find((e) => e.id === Number(eq.equipment_id))
        }))
      };
    });
    const newRequest = {
      id: newId,
      title: title || "Untitled Facility Reservation",
      purpose: purpose || "Official university academic/extracurricular program.",
      priority_level: Number(priority_level) || 0,
      status: "Pending",
      on_hold: false,
      recommended_action: "Approved",
      recommendation_reason: "Automated AI audit validated capacity requirements and zero inventory conflicts.",
      user_id: user.id,
      user,
      approvers: settingsData.approvers.map((name) => ({ name, status: "Pending" })),
      facilities: mappedFacilities,
      comments: [],
      files: [],
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    requests.unshift(newRequest);
    auditLogs.unshift({
      id: auditLogs.length + 1,
      request_id: newId,
      user_id: user.id,
      user,
      event: "Request Created",
      description: `Request #${newId} created by ${user.name}`,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (req.headers["x-inertia"]) {
      res.setHeader("X-Inertia-Location", `/requests/${newId}`);
      return res.status(303).redirect(`/requests/${newId}`);
    }
    res.redirect(`/requests/${newId}`);
  });
  app.get("/requests/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = requests.find((r) => r.id === id);
    if (!target) {
      return res.redirect("/requests");
    }
    const reqLogs = auditLogs.filter((l) => l.request_id === id);
    renderInertia(req, res, "requests/detail", {
      page_title: target.title,
      breadcrumbs: [
        { title: "Requests", url: "/requests" },
        { title: `#${target.id}`, url: `/requests/${target.id}` }
      ],
      request: target,
      auditLogs: {
        data: reqLogs,
        current_page: 1,
        last_page: 1,
        total: reqLogs.length
      },
      approvers: target.approvers,
      isAdmin: getCurrentUser().role === "Super Admin" || getCurrentUser().role === "admin"
    });
  });
  app.get("/requests/:id/edit", (req, res) => {
    const id = Number(req.params.id);
    const target = requests.find((r) => r.id === id);
    if (!target) return res.redirect("/requests");
    renderInertia(req, res, "requests/create", {
      page_title: `Edit Request: ${target.title}`,
      breadcrumbs: [
        { title: "Requests", url: "/requests" },
        { title: `#${target.id}`, url: `/requests/${target.id}` },
        { title: "Edit", url: `/requests/${target.id}/edit` }
      ],
      existingRequest: target,
      facilities,
      equipments,
      requestOptions: {
        approvers: settingsData.approvers,
        booking_window: settingsData.booking_window,
        min_advance_days: settingsData.min_advance_days
      },
      bookingWindow: settingsData.booking_window,
      minAdvanceDays: settingsData.min_advance_days
    });
  });
  app.post("/requests/:id/approve", (req, res) => {
    const id = Number(req.params.id);
    const target = requests.find((r) => r.id === id);
    if (target) {
      target.status = "Approved";
      target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      target.approvers.forEach((a) => {
        a.status = "Approved";
      });
      auditLogs.unshift({
        id: auditLogs.length + 1,
        request_id: id,
        user_id: getCurrentUser().id,
        user: getCurrentUser(),
        event: "Request Approved",
        description: `Request #${id} approved by ${getCurrentUser().name}`,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    res.redirect(303, `/requests/${id}`);
  });
  app.post("/requests/:id/reject", (req, res) => {
    const id = Number(req.params.id);
    const { reason } = req.body;
    const target = requests.find((r) => r.id === id);
    if (target) {
      target.status = "Rejected";
      target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      if (reason) {
        target.comments.push({
          id: target.comments.length + 1,
          request_id: id,
          user_id: getCurrentUser().id,
          user: getCurrentUser(),
          comment: `Rejection Note: ${reason}`,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      auditLogs.unshift({
        id: auditLogs.length + 1,
        request_id: id,
        user_id: getCurrentUser().id,
        user: getCurrentUser(),
        event: "Request Rejected",
        description: `Request #${id} rejected by ${getCurrentUser().name}`,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    res.redirect(303, `/requests/${id}`);
  });
  app.post("/requests/:id/conditional-approve", (req, res) => {
    const id = Number(req.params.id);
    const target = requests.find((r) => r.id === id);
    if (target) {
      target.status = "Conditionally Approved";
      target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    res.redirect(303, `/requests/${id}`);
  });
  app.post("/requests/:id/reschedule", (req, res) => {
    const id = Number(req.params.id);
    const target = requests.find((r) => r.id === id);
    if (target) {
      target.status = "For Reschedule";
      target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    res.redirect(303, `/requests/${id}`);
  });
  app.post("/requests/:id/hold", (req, res) => {
    const id = Number(req.params.id);
    const target = requests.find((r) => r.id === id);
    if (target) {
      target.on_hold = !target.on_hold;
      target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    res.redirect(303, `/requests/${id}`);
  });
  app.post("/requests/:id/comment", (req, res) => {
    const id = Number(req.params.id);
    const { comment } = req.body;
    const target = requests.find((r) => r.id === id);
    if (target && comment) {
      target.comments.push({
        id: target.comments.length + 1,
        request_id: id,
        user_id: getCurrentUser().id,
        user: getCurrentUser(),
        comment,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    res.redirect(303, `/requests/${id}`);
  });
  app.get("/requests/:id/alternatives", (req, res) => {
    const id = Number(req.params.id);
    const target = requests.find((r) => r.id === id);
    const firstFacility = target?.facilities[0];
    const eventDate = firstFacility?.event_date || formatDate(3);
    const alternatives = [
      {
        id: "alt-1",
        type: "same_facility_time",
        facility: firstFacility?.facility || facilities[0],
        date: eventDate,
        start_time: "13:00:00",
        end_time: "17:00:00",
        capacity_fit: "exact",
        score: 95,
        reason: "Optimal afternoon window with identical capacity and equipment setup."
      },
      {
        id: "alt-2",
        type: "same_facility_date",
        facility: firstFacility?.facility || facilities[0],
        date: formatDate(6),
        start_time: firstFacility?.start_time || "09:00:00",
        end_time: firstFacility?.end_time || "14:00:00",
        capacity_fit: "exact",
        score: 88,
        reason: "Nearby date offering clear building schedule."
      },
      {
        id: "alt-3",
        type: "different_facility",
        facility: facilities[4],
        date: eventDate,
        start_time: firstFacility?.start_time || "09:00:00",
        end_time: firstFacility?.end_time || "14:00:00",
        capacity_fit: "larger",
        score: 82,
        reason: "CEIT Hall 6C available at identical requested timeslot with ample seating."
      }
    ];
    res.json({ alternatives, total: alternatives.length });
  });
  app.get("/requests/:id/recommendation", (req, res) => {
    const id = Number(req.params.id);
    const target = requests.find((r) => r.id === id);
    res.json({
      status: "completed",
      recommended_action: target?.recommended_action || "Approved",
      reason: target?.recommendation_reason || "Verified schedule availability and room parameters."
    });
  });
  app.get("/requests/:id/audit-logs", (req, res) => {
    const id = Number(req.params.id);
    const logs = auditLogs.filter((l) => l.request_id === id);
    res.json({
      data: logs,
      current_page: 1,
      last_page: 1,
      total: logs.length
    });
  });
  app.get("/facilities", (req, res) => {
    renderInertia(req, res, "facilities/index", {
      page_title: "Facilities Catalog",
      breadcrumbs: [{ title: "Facilities", url: "/facilities" }],
      campuses,
      buildings,
      facilities,
      activeCampuses: campuses,
      activeBuildings: buildings,
      showArchived: false
    });
  });
  app.post("/facilities", (req, res) => {
    const { building_id, name, capacity, description } = req.body;
    const newId = facilities.length ? Math.max(...facilities.map((f) => f.id)) + 1 : 1;
    const building = buildings.find((b) => b.id === Number(building_id));
    const newFacility = {
      id: newId,
      building_id: Number(building_id),
      name: name || "New Facility",
      capacity: Number(capacity) || 50,
      description: description || "",
      building
    };
    facilities.push(newFacility);
    res.redirect(303, "/facilities");
  });
  app.get("/facilities/getSchedule/:facility/:date", (req, res) => {
    const facilityId = Number(req.params.facility);
    const date = req.params.date;
    const booked = requests.filter((r) => r.status === "Approved" || r.status === "Pending").flatMap((r) => r.facilities).filter((f) => f.facility_id === facilityId && f.event_date === date);
    res.json({
      date,
      facility_id: facilityId,
      reservations: booked.map((b) => ({
        id: b.id,
        start_time: b.start_time,
        end_time: b.end_time,
        request_title: requests.find((r) => r.id === b.request_id)?.title || "Reserved"
      }))
    });
  });
  app.get("/facilities/getCalendarSchedule/:id", (req, res) => {
    const fid = Number(req.params.id);
    const events = requests.flatMap((r) => r.facilities).filter((f) => f.facility_id === fid).map((f) => ({
      id: f.id,
      title: requests.find((r) => r.id === f.request_id)?.title || "Reserved",
      start: `${f.event_date}T${f.start_time}`,
      end: `${f.event_date}T${f.end_time}`
    }));
    res.json(events);
  });
  app.get("/equipments", (req, res) => {
    const mappedEquipments = equipments.map((e) => ({
      id: e.id,
      name: e.name,
      quantity: e.total_quantity,
      facilities: []
    }));
    renderInertia(req, res, "equipments/index", {
      page_title: "Equipment Inventory",
      breadcrumbs: [{ title: "Equipments", url: "/equipments" }],
      equipments: {
        data: mappedEquipments,
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: mappedEquipments.length,
        from: 1,
        to: mappedEquipments.length
      },
      facilities: facilities.map((f) => ({
        id: f.id,
        name: f.name,
        building: f.building?.name,
        capacity: f.capacity
      })),
      filters: { search: "", sort: "" }
    });
  });
  app.post("/equipments", (req, res) => {
    const { name, total_quantity, quantity, description } = req.body;
    const newId = equipments.length ? Math.max(...equipments.map((e) => e.id)) + 1 : 1;
    equipments.push({
      id: newId,
      name,
      total_quantity: Number(quantity || total_quantity) || 1,
      description
    });
    res.redirect(303, "/equipments");
  });
  app.put("/equipments/:id", (req, res) => {
    const id = Number(req.params.id);
    const { name, quantity, total_quantity } = req.body;
    const eq = equipments.find((e) => e.id === id);
    if (eq) {
      if (name) eq.name = name;
      if (quantity || total_quantity) eq.total_quantity = Number(quantity || total_quantity);
    }
    res.redirect(303, "/equipments");
  });
  app.delete("/equipments/:id", (req, res) => {
    const id = Number(req.params.id);
    const index = equipments.findIndex((e) => e.id === id);
    if (index !== -1) {
      equipments.splice(index, 1);
    }
    res.redirect(303, "/equipments");
  });
  app.post("/equipments/:id/sync-facilities", (req, res) => {
    res.json({ success: true });
  });
  app.post("/equipment/check-conflicts", (req, res) => {
    res.json({ conflicts: [], has_conflicts: false });
  });
  app.get("/equipment/availability", (req, res) => {
    res.json(equipments);
  });
  app.get("/rules", (req, res) => {
    const policyList = rules.filter((r) => r.forPolicy === 0);
    const faqList = rules.filter((r) => r.forPolicy === 1);
    renderInertia(req, res, "rules/index", {
      page_title: "Rules & FAQ Management",
      breadcrumbs: [{ title: "Rules & FAQs", url: "/rules" }],
      policies: policyList,
      faqs: faqList,
      rules: policyList
    });
  });
  app.post("/rules", (req, res) => {
    const { title, content, forPolicy, category } = req.body;
    const newId = rules.length ? Math.max(...rules.map((r) => r.id)) + 1 : 1;
    rules.push({
      id: newId,
      title,
      content,
      forPolicy: Number(forPolicy) || 0,
      order: rules.length + 1,
      category
    });
    res.redirect(303, "/rules");
  });
  app.post("/rules/reorder", (req, res) => {
    res.json({ success: true });
  });
  app.post("/rules/index-rules", (req, res) => {
    res.json({ success: true, message: "All policy rules and FAQs successfully indexed into AI vector store." });
  });
  app.get("/accounts", (req, res) => {
    renderInertia(req, res, "accounts/index", {
      page_title: "Account Management",
      breadcrumbs: [{ title: "Accounts", url: "/accounts" }],
      users: {
        data: users.filter((u) => !u.deleted_at),
        links: [{ url: null, label: "1", active: true }],
        current_page: 1,
        last_page: 1,
        total: users.length
      }
    });
  });
  app.post("/accounts", (req, res) => {
    const { name, email, role } = req.body;
    const newId = users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    users.push({
      id: newId,
      name,
      email,
      role: role || "Department Head",
      roles: [role || "Department Head"],
      permissions: role === "admin" || role === "Super Admin" ? ["view requests", "create requests", "approve requests", "reject requests", "manage facilities"] : ["view requests", "create requests"],
      is_active: true,
      avatar: null,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.redirect(303, "/accounts");
  });
  app.post("/accounts/:id/toggle-status", (req, res) => {
    const id = Number(req.params.id);
    const u = users.find((user) => user.id === id);
    if (u) {
      u.is_active = !u.is_active;
    }
    res.redirect(303, "/accounts");
  });
  app.get("/settings", (req, res) => {
    renderInertia(req, res, "settings/index", {
      page_title: "User & System Settings",
      breadcrumbs: [{ title: "Settings", url: "/settings" }],
      settings: settingsData
    });
  });
  app.get("/settings/request-options", (req, res) => {
    renderInertia(req, res, "settings/request-options", {
      page_title: "Request Options Configuration",
      breadcrumbs: [
        { title: "Settings", url: "/settings" },
        { title: "Request Options", url: "/settings/request-options" }
      ],
      approvers: settingsData.approvers,
      bookingWindow: settingsData.booking_window,
      minAdvanceDays: settingsData.min_advance_days
    });
  });
  app.put("/settings/request-options", (req, res) => {
    const { approvers, bookingWindow, minAdvanceDays } = req.body;
    if (approvers) settingsData.approvers = approvers;
    if (bookingWindow) settingsData.booking_window = bookingWindow;
    if (minAdvanceDays !== void 0) settingsData.min_advance_days = Number(minAdvanceDays);
    res.redirect(303, "/settings/request-options");
  });
  app.get("/chatbot", (req, res) => {
    renderInertia(req, res, "chatbot/chatbot", {
      page_title: "FRAI Assistant",
      breadcrumbs: [{ title: "FRAI AI Assistant", url: "/chatbot" }]
    });
  });
  app.get("/chatbot/logs", (req, res) => {
    renderInertia(req, res, "chatbot/logs/index", {
      page_title: "Chatbot Interaction Logs",
      breadcrumbs: [{ title: "Chatbot Logs", url: "/chatbot/logs" }],
      logs: {
        data: chatbotLogs,
        links: [{ url: null, label: "1", active: true }],
        current_page: 1,
        last_page: 1,
        total: chatbotLogs.length
      },
      filters: {
        user: "",
        status: "",
        intent: "",
        date: "",
        search: ""
      },
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      statusOptions: ["All", "success", "warning", "error"],
      intentOptions: ["All", "Booking Inquiry", "Facility Availability", "Policy Question", "Conflict Resolution"]
    });
  });
  app.get("/chat/session", (req, res) => {
    const sessionId = req.query.session_id || "default-session";
    const history = activeChatSessions.get(sessionId) || [];
    res.json({
      session_id: sessionId,
      messages: history
    });
  });
  app.post("/chat/session", (req, res) => {
    const sessionId = req.body?.session_id || `session-${Date.now()}`;
    if (!activeChatSessions.has(sessionId)) {
      activeChatSessions.set(sessionId, []);
    }
    res.json({ session_id: sessionId });
  });
  app.delete("/chat/session", (req, res) => {
    const sessionId = req.query.session_id || "default-session";
    activeChatSessions.delete(sessionId);
    res.json({ success: true, messages: [] });
  });
  app.get(["/api/page/context", "/api/page-context"], (req, res) => {
    res.json({
      context: {
        current_user: getCurrentUser(),
        facilities: facilities.map((f) => ({
          id: f.id,
          name: f.name,
          capacity: f.capacity,
          building: f.building?.name,
          campus: f.campus?.name
        })),
        rules: rules.map((r) => ({ id: r.id, title: r.title, content: r.content })),
        equipments_count: equipments.length,
        pending_requests_count: requests.filter((r) => r.status === "Pending").length
      }
    });
  });
  app.get("/chat/models", (req, res) => {
    res.json({
      models: [
        { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash (Active)", available: true },
        { id: "frai-knowledge-rag", name: "FRAI Knowledge Engine", available: true }
      ]
    });
  });
  app.get("/chat/rules", (req, res) => {
    res.json({ rules });
  });
  app.get("/chat/facilities", (req, res) => {
    res.json({ facilities });
  });
  app.get("/chat/equipment", (req, res) => {
    res.json({ equipments });
  });
  app.get("/chat/requests", (req, res) => {
    const user = getCurrentUser();
    const userRequests = requests.filter((r) => r.user_id === user.id);
    res.json({ requests: userRequests });
  });
  app.post("/chat/upload", (req, res) => {
    res.json({ success: true, file_id: `file-${Date.now()}`, name: "attachment" });
  });
  app.post("/chat/stream", async (req, res) => {
    const rawMessage = req.body.message || (Array.isArray(req.body.messages) ? req.body.messages.filter((m) => m.role === "user").slice(-1)[0]?.content : "") || "";
    const sessionId = req.body.session_id || "default-session";
    const query = String(rawMessage || "").toLowerCase();
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const matchedRule = rules.find(
      (r) => query.includes(r.title.toLowerCase()) || r.content.toLowerCase().includes(query)
    );
    let finalResponse = "";
    const systemPrompt = `You are FRAI (Facility Request with AI Assistant), the official facility reservation and policy advisor for the University.
You guide university students, faculty, and administrators in checking facility capacities, equipment loan rules, approval workflows, and booking policies.

Official Facilities:
${facilities.map((f) => `- ${f.name} (Capacity: ${f.capacity}, Building: ${f.building?.name}, Campus: ${f.campus?.name})`).join("\n")}

Booking & Approval Policies:
${rules.map((r) => `- [${r.title}] ${r.content}`).join("\n")}

University Guidelines:
1. Standard facility reservation requests must be submitted at least 5 working days before the scheduled event.
2. If the user expresses intent to book a room, provide a clean overview of capacity, required equipment, and recommend creating a reservation request.
3. Be professional, concise, polite, and helpful.`;
    const ai = getGenAI();
    if (ai && rawMessage.trim()) {
      try {
        const responseStream = await ai.models.generateContentStream({
          model: "gemini-3.7-flash",
          contents: rawMessage,
          config: {
            systemInstruction: systemPrompt
          }
        });
        for await (const chunk of responseStream) {
          if (chunk.text) {
            finalResponse += chunk.text;
            res.write(`data: ${JSON.stringify({ token: chunk.text, text: chunk.text })}

`);
          }
        }
      } catch (err) {
        console.warn("Gemini stream failed, falling back to knowledge engine:", err);
        const fallbackText = matchedRule ? `${matchedRule.content}

Is there anything else regarding facility reservations or equipment loans I can assist you with?` : `I can help you check facility availability, review university booking guidelines, and prepare reservation requests.

We have facilities such as the **Main Auditorium** (500 capacity), **Assembly Hall** (800 capacity), **CEIT Lecture Hall** (160 capacity), and **Multi-Purpose Halls**.

Please remember that requests must be submitted at least 5 working days in advance!`;
        finalResponse = fallbackText;
        for (const word of fallbackText.split(" ")) {
          res.write(`data: ${JSON.stringify({ token: `${word} `, text: `${word} ` })}

`);
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
    } else {
      const fallbackText = matchedRule ? `${matchedRule.content}

Feel free to ask for more details on equipment loans, approver timelines, or booking forms.` : `Hello! I am FRAI, your AI Facility Reservation assistant.

Here are some quick things you can ask me:
- "What is the seating capacity of the Assembly Hall?"
- "What are the rules on advance booking and equipment?"
- "How do I reschedule a pending reservation?"

How can I help your event today?`;
      finalResponse = fallbackText;
      for (const word of fallbackText.split(" ")) {
        res.write(`data: ${JSON.stringify({ token: `${word} `, text: `${word} ` })}

`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    const sessionHistory = activeChatSessions.get(sessionId) || [];
    sessionHistory.push(
      { role: "user", content: rawMessage },
      { role: "assistant", content: finalResponse }
    );
    activeChatSessions.set(sessionId, sessionHistory.slice(-20));
    chatbotLogs.unshift({
      id: chatbotLogs.length + 1,
      session_id: sessionId,
      user_id: getCurrentUser().id,
      user: getCurrentUser(),
      message: rawMessage || "",
      response: finalResponse,
      status: "success",
      intent: matchedRule ? "Policy Question" : "Facility Availability",
      matched_rule_id: matchedRule?.id,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.write(`data: ${JSON.stringify({ done: true })}

`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
  app.post("/chat", async (req, res) => {
    const rawMessage = req.body.message || (Array.isArray(req.body.messages) ? req.body.messages.filter((m) => m.role === "user").slice(-1)[0]?.content : "") || "";
    const sessionId = req.body.session_id || "default-session";
    const query = String(rawMessage || "").toLowerCase();
    const matchedRule = rules.find(
      (r) => query.includes(r.title.toLowerCase()) || r.content.toLowerCase().includes(query)
    );
    let finalResponse = "";
    const systemPrompt = `You are FRAI (Facility Request with AI Assistant), the official facility reservation and policy advisor for the University.
You guide university students, faculty, and administrators in checking facility capacities, equipment loan rules, approval workflows, and booking policies.

Official Facilities:
${facilities.map((f) => `- ${f.name} (Capacity: ${f.capacity}, Building: ${f.building?.name}, Campus: ${f.campus?.name})`).join("\n")}

Booking & Approval Policies:
${rules.map((r) => `- [${r.title}] ${r.content}`).join("\n")}

University Guidelines:
1. Standard facility reservation requests must be submitted at least 5 working days before the scheduled event.
2. If the user expresses intent to book a room, provide a clean overview of capacity, required equipment, and recommend creating a reservation request.
3. Be professional, concise, polite, and helpful.`;
    const ai = getGenAI();
    if (ai && rawMessage.trim()) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: rawMessage,
          config: {
            systemInstruction: systemPrompt
          }
        });
        finalResponse = response.text || "";
      } catch (err) {
        console.warn("Gemini chat failed, falling back to knowledge engine:", err);
        finalResponse = matchedRule ? `${matchedRule.content}

Is there anything else regarding facility reservations I can assist you with?` : `I can help you check facility availability, review university booking guidelines, and prepare reservation requests.

We have facilities such as the **Main Auditorium** (500 capacity), **Assembly Hall** (800 capacity), **CEIT Lecture Hall** (160 capacity), and **Multi-Purpose Halls**.

Please remember that requests must be submitted at least 5 working days in advance!`;
      }
    }
    if (!finalResponse) {
      finalResponse = matchedRule ? matchedRule.content : "I can assist you with booking university facilities, checking capacities, and reviewing approval rules.";
    }
    const sessionHistory = activeChatSessions.get(sessionId) || [];
    sessionHistory.push(
      { role: "user", content: rawMessage },
      { role: "assistant", content: finalResponse }
    );
    activeChatSessions.set(sessionId, sessionHistory.slice(-20));
    chatbotLogs.unshift({
      id: chatbotLogs.length + 1,
      session_id: sessionId,
      user_id: getCurrentUser().id,
      user: getCurrentUser(),
      message: rawMessage || "",
      response: finalResponse,
      status: "success",
      intent: matchedRule ? "Policy Question" : "Booking Inquiry",
      matched_rule_id: matchedRule?.id,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({
      message: {
        role: "assistant",
        content: finalResponse
      },
      response: finalResponse,
      session_id: sessionId
    });
  });
  app.post("/chat/create-request", (req, res) => {
    const { title, participant_count, facility_bookings, description, priority_level, priority_reason, files } = req.body;
    const user = getCurrentUser();
    const newId = requests.length ? Math.max(...requests.map((r) => r.id)) + 1 : 1;
    const mappedFacilities = (facility_bookings || []).map((fb, idx) => {
      const fullFacility = facilities.find((fac) => fac.id === Number(fb.facility_id));
      return {
        id: newId * 100 + idx,
        request_id: newId,
        facility_id: Number(fb.facility_id),
        facility: fullFacility,
        event_date: fb.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        start_time: fb.time_start || "08:00",
        end_time: fb.time_end || "12:00",
        equipments: (fb.equipment || []).map((eq, eqIdx) => ({
          id: newId * 1e3 + eqIdx,
          equipment_id: Number(eq.equipment_id),
          quantity: Number(eq.quantity_needed || eq.quantity || 1),
          equipment: equipments.find((e) => e.id === Number(eq.equipment_id))
        }))
      };
    });
    const newRequest = {
      id: newId,
      title: title || "Facility Booking from FRAI Assistant",
      purpose: description || `Official university reservation for ${participant_count ? `${participant_count} participants` : "academic/administrative activity"}.`,
      priority_level: Number(priority_level) || 0,
      status: "Pending",
      on_hold: false,
      recommended_action: "Approved",
      recommendation_reason: priority_reason || "Capacity requirements and scheduling availability validated automatically.",
      user_id: user.id,
      user,
      approvers: settingsData.approvers.map((name) => ({ name, status: "Pending" })),
      facilities: mappedFacilities,
      comments: [],
      files: files || [],
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    requests.unshift(newRequest);
    auditLogs.unshift({
      id: auditLogs.length + 1,
      request_id: newId,
      user_id: user.id,
      user,
      event: "Request Created via Chatbot",
      description: `Reservation #${newId} created through FRAI Assistant for ${user.name}`,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({
      success: true,
      request_id: String(newId),
      message: `Facility reservation #${newId} created successfully!`
    });
  });
  app.post("/chat/:sessionId/feedback", (req, res) => {
    const { feedback } = req.body;
    const sessionLog = chatbotLogs.find((l) => l.session_id === req.params.sessionId);
    if (sessionLog) {
      sessionLog.feedback = feedback;
    }
    res.json({ success: true });
  });
  app.post("/chatbot/logs/clear", (req, res) => {
    chatbotLogs.length = 0;
    res.json({ success: true });
  });
  app.post("/push/subscribe", (req, res) => {
    res.json({ success: true, message: "Device token subscribed" });
  });
  app.post("/push/unsubscribe", (req, res) => {
    res.json({ success: true, message: "Device token unsubscribed" });
  });
  if (process.env.NODE_ENV !== "production") {
    viteDevServer = await (0, import_vite.createServer)({
      server: { middlewareMode: true, hmr: false },
      appType: "custom"
    });
    app.use(viteDevServer.middlewares);
    app.use((req, res) => {
      renderInertia(req, res, "dashboard", { page_title: "Dashboard" });
    });
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.use((req, res) => {
      renderInertia(req, res, "dashboard", { page_title: "Dashboard" });
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FRAI Fullstack Application running at http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
