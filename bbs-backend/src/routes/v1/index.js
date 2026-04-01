import { Router } from "express";
import bookingRoutes from "../../modules/booking/routes/booking.routes.js";
import authRoutes from "../../modules/user/routes/auth.routes.js";
import facilityRoutes from "../../modules/facility/routes/facility.routes.js";
import billingRoutes from "../../modules/billing/routes/billing.routes.js";
import adminAuthRoutes from "../../modules/admin/routes/admin.auth.routes.js";
import paymentRoutes from "../../modules/payment/routes/payment.routes.js";
import settingRoutes from "../../modules/admin/routes/setting.routes.js";

const v1Routes = Router();

v1Routes.use("/auth", authRoutes);
v1Routes.use("/auth/admin", adminAuthRoutes);
v1Routes.use("/settings", settingRoutes);
v1Routes.use("/facilities", facilityRoutes);
v1Routes.use("/bookings", bookingRoutes);
v1Routes.use("/billing", billingRoutes);
v1Routes.use("/payments", paymentRoutes);

export default v1Routes;
