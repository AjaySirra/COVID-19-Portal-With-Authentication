const express = require("express");
const app = express();
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
let db = null;
app.use(express.json());
const jwt = require("jsonwebtoken");

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running On http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBandServer();
//AuthenticateToken
const stateConverter = (stateList) => {
  return {
    stateId: stateList.state_id,
    stateName: stateList.state_name,
    population: stateList.population,
  };
};

const districtConverter = (districtList) => {
  return {
    districtId: districtList.district_id,
    districtName: districtList.district_name,
    stateId: districtList.state_id,
    cases: districtList.cases,
    cured: districtList.cured,
    active: districtList.active,
    deaths: districtList.deaths,
  };
};
function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}
//Login Details
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET all states
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT *
    FROM state ;`;
  const stateDetails = await db.all(getStatesQuery);
  response.send(stateDetails.map((eachState) => stateConverter(eachState)));
});

//GET state
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT*
    FROM state Where state_id=${stateId};`;
  const stateDetails = await db.get(getStateQuery);
  response.send(stateConverter(stateDetails));
});

//POST district
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `INSERT INTO district
    (district_name,state_id,cases,cured,active,deaths)
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(postQuery);
  response.send("District Successfully Added");
});

//GET district
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT *
    FROM district WHERE district_id=${districtId};`;
    const districtDetails = await db.get(getDistrictQuery);
    response.send(districtConverter(districtDetails));
  }
);

//DELETE district
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `DELETE 
    FROM district WHERE district_id=${districtId};`;
    await db.run(getDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE district
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district
  SET district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}
  WHERE district_id=${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GET states
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT SUM(cases) AS totalCases ,
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths) AS totalDeaths
  FROM district WHERE state_id=${stateId};`;
    const totalStats = await db.get(getStatsQuery);
    response.send(totalStats);
  }
);

module.exports = app;
