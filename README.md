mesakoeun: Project Overview and Setup Guide

Project Introduction

The mesakoeun project is a robust Geographical Management System specifically engineered for Cambodian (KH) administrative data. While the repository’s metadata description—"Config files for my GitHub profile"—suggests a personal configuration repo, the underlying codebase is a sophisticated implementation of geographic data handling, providing province-to-village mapping and history tracking.

To ensure versatility across hosting environments, the project features a dual-backend architecture, offering a primary implementation in Node.js and an active conversion effort toward a PHP-based environment.

Tech Stack

* JavaScript (54.3%): Powers the primary Node.js backend logic and server-side operations.
* PHP (30.1%): An alternative backend implementation currently under active development.
* HTML (15.6%): Structured frontend for user interaction and data visualization.

Project Structure

The repository is organized into a modular architecture, separating the core application logic from the database migration scripts and the localized frontend.

Directory Tree

mesakoeun/
├── .github/
│   └── agents/
├── controlers/
├── php_project/
├── Frontend/
├── routes/
├── .gitignore
├── README.md
├── app.js
├── corrected.sql
├── db.js
├── edit_history.sql
├── example.sql
├── generate_kh_place.php
├── insert.sql
├── kh-places-insert.sql
├── kh-places.csv
├── package-lock.json
├── package.json
├── server.js
└── sq.sql


Key Directories and Files

Directory/File	Purpose	Notes
Frontend/	Client-side user interface and search components.	Updated recently to support "History View."
controlers/	Core logic for request handling and data processing.	Note: Retains original source spelling.
routes/	API endpoint definitions and navigation routing.	Critical for backend communication.
convertophp/	Target directory for the Node.js-to-PHP backend migration.	Active conversion effort in progress.
app.js	Entry point specifically handling "search" functionality.	Core application logic.
server.js	Server initialization and console management.	Recently updated to refine console logging.
db.js	Database connection pool and configuration logic.	Actively maintained; handles history view logic.

Database Setup

A relational database environment (MySQL or MariaDB) is a prerequisite for this project. The system relies on a series of SQL scripts to build the schema and populate Cambodian administrative data.

Initialization Sequence

To ensure referential integrity, execute the scripts in the following order:

1. Schema Initialization:
  * Recommended: Run corrected.sql for the most recent frontend/backend logic and database schema updates.
  * Legacy: example.sql is available for boilerplate initialization but is considered deprecated compared to corrected.sql.
2. Data Population:
  * Execute kh-places-insert.sql to populate granular data (districts, communes, and villages).
  * Use server.js to generate 2 M records for testing purpose.
3. Data Correction & Auditing:
  * Apply corrected.sql. This is the most recent logic update (as of last week) and should be treated as the final state of the schema.
  * Execute edit_history.sql to enable the tracking of modifications and the "History View" functionality.

Data Assets:

* kh-places.csv: The authoritative raw data source for provinces through villages.
* generate_kh_place.php: A utility script used to bridge the raw CSV data into valid SQL insertion logic within the PHP environment.

Backend Configuration

Node.js Setup (Primary)

The Node.js environment is the most mature backend implementation in the repository.

1. Dependency Management: Install the required packages defined in package.json:
2. Launching the Service:
  * To start the main server with refined console logging: node server.js
  * To focus on the search-specific logic: node app.js

PHP Setup (Alternative/Migration)

The project is currently undergoing a "Node.js to PHP" conversion. The logic found in convertophp/ and convertnodetophp/ is intended for environments where Node.js is unavailable. Use generate_kh_place.php to automate the database population if you are deploying the PHP variant.

Frontend Deployment

The Frontend directory contains the assets required for the user interface. This interface is designed to be backend-agnostic but requires a running API to function.

* Deployment Note: Ensure that either the Node.js or PHP backend is fully initialized and the database is accessible before launching the frontend. Without an active backend service, the "Search" and "History View" features will fail to retrieve data.

Development and Contribution

As a Senior Full-Stack project, recent activity focuses on refining the developer experience and system observability.

* Active Maintenance: Recent commits have focused on updating the "History View" (affecting Frontend and db.js) and refining server-side console feedback in server.js.
* AI-Assisted Development: The .github/agents directory suggests the use of AI-assisted coding or automation agents. Contributors should check these configurations to align with the repository's automated standards.
* Standards: Review .gitignore before submitting changes; the project maintains a strict policy against committing unnecessary SQL dumps or environment-specific binaries to keep the repository clean.
