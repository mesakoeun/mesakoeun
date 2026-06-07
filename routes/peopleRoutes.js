import express from "express";
import {
  getProvinces,
  getDistricts,
  getCommunes,
  getVillages,
  searchPeople,
  loginUser,
  getPersonById,
  getPersonHistory,
  createPerson,
  updatePerson,
} from "../controlers/peopleController.js";
import { getDemographicReport } from "../controlers/reportController.js";

const router = express.Router();

router.post("/login", loginUser);
router.get("/report", getDemographicReport);
router.get("/provinces", getProvinces);
router.get("/districts/:province_id", getDistricts); // Dynamic param for filtering
router.get("/communes/:district_id", getCommunes); // Dynamic param for filtering
router.get("/villages/:commune_id", getVillages); // Dynamic param for filtering
router.get("/search", searchPeople);
router.get("/people/:id", getPersonById);
router.get("/people/:id/history", getPersonHistory);
router.post("/people", createPerson);
router.put("/people/:id", updatePerson);

export default router;
