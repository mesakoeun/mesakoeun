import express from "express";
import {
  getProvinces,
  getDistricts,
  getCommunes,
  getVillages,
  searchPeople,
} from "../controlers/peopleController.js";

const router = express.Router();

router.get("/provinces", getProvinces);
router.get("/districts/:province_id", getDistricts); // Dynamic param for filtering
router.get("/communes/:district_id", getCommunes); // Dynamic param for filtering
router.get("/villages/:commune_id", getVillages); // Dynamic param for filtering
router.get("/search", searchPeople);

export default router;
