-- =============================================================
-- Cambodia Places — Fixed Schema (No Auto-Increment)
-- Uses Official National Geocodes as Primary/Foreign Keys
-- =============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- -------------------------------------------------------------
-- PROVINCE (e.g., ID: 1, 2, 12...)
-- -------------------------------------------------------------
CREATE TABLE tbl_province (
    id         INT UNSIGNED     PRIMARY KEY,
    name_latin VARCHAR(150)     NOT NULL,
    name_khmer VARCHAR(150)     NOT NULL,
    created_at TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_province_name_latin (name_latin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- DISTRICT (e.g., ID: 102, 1201...)
-- -------------------------------------------------------------
CREATE TABLE tbl_district (
    id          INT UNSIGNED    PRIMARY KEY,
    province_id INT UNSIGNED    NOT NULL,
    name_latin  VARCHAR(150)    NOT NULL,
    name_khmer  VARCHAR(150)    NOT NULL,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_district_province
        FOREIGN KEY (province_id) REFERENCES tbl_province(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX       idx_province_id (province_id),
    UNIQUE KEY  uk_district     (province_id, name_latin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- COMMUNE (e.g., ID: 10201, 120101...)

-- -------------------------------------------------------------
-- COMMUNE (Updated - Removed unique key name constraint)
-- -------------------------------------------------------------
CREATE TABLE tbl_commune (
    id          INT UNSIGNED    PRIMARY KEY, 
    province_id INT UNSIGNED    NOT NULL,
    district_id INT UNSIGNED    NOT NULL,
    name_latin  VARCHAR(150)    NOT NULL,
    name_khmer  VARCHAR(150)    NOT NULL,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_commune_province
        FOREIGN KEY (province_id) REFERENCES tbl_province(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_commune_district
        FOREIGN KEY (district_id) REFERENCES tbl_district(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX       idx_commune_district (district_id),
    INDEX       idx_commune_name     (name_latin) -- Changed from UNIQUE KEY to a standard INDEX
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- VILLAGE (Updated - Removed unique key name constraint)
-- -------------------------------------------------------------
CREATE TABLE tbl_village (
    id          INT UNSIGNED    PRIMARY KEY, 
    province_id INT UNSIGNED    NOT NULL,
    district_id INT UNSIGNED    NOT NULL,
    commune_id  INT UNSIGNED    NOT NULL,
    name_latin  VARCHAR(150)    NOT NULL,
    name_khmer  VARCHAR(150)    NOT NULL,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_village_province
        FOREIGN KEY (province_id) REFERENCES tbl_province(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_village_district
        FOREIGN KEY (district_id) REFERENCES tbl_district(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_village_commune
        FOREIGN KEY (commune_id) REFERENCES tbl_commune(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX       idx_village_commune (commune_id),
    INDEX       idx_village_name    (name_latin) -- Changed from UNIQUE KEY to a standard INDEX
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- PEOPLE
-- -------------------------------------------------------------
CREATE TABLE people (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    givenname   VARCHAR(100)    NOT NULL,
    surname     VARCHAR(100)    NOT NULL,
    gender      ENUM('Male','Female') NOT NULL,
    dob         DATE,
    province_id INT UNSIGNED,
    district_id INT UNSIGNED,
    commune_id  INT UNSIGNED,
    village_id  INT UNSIGNED,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_people_province
        FOREIGN KEY (province_id) REFERENCES tbl_province(id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT fk_people_district
        FOREIGN KEY (district_id) REFERENCES tbl_district(id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT fk_people_commune
        FOREIGN KEY (commune_id)  REFERENCES tbl_commune(id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT fk_people_village
        FOREIGN KEY (village_id)  REFERENCES tbl_village(id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_surname    (surname),
    INDEX idx_givenname  (givenname),
    INDEX idx_dob        (dob),
    INDEX idx_gender     (gender),
    INDEX idx_location   (province_id, district_id, commune_id, village_id),
    INDEX idx_report_performance (province_id, district_id, commune_id, village_id, gender, dob)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- SUMMARY DEMOGRAPHICS
-- -------------------------------------------------------------
CREATE TABLE summary_demographics (
    province_id INT UNSIGNED,
    district_id INT UNSIGNED,
    commune_id  INT UNSIGNED,
    village_id  INT UNSIGNED,
    birth_year  INT,
    gender      ENUM('Male','Female'),
    total_people INT           DEFAULT 0,

    INDEX       idx_summary_filter (province_id, district_id, commune_id, birth_year),
    UNIQUE KEY  uk_summary         (province_id, district_id, commune_id, village_id, birth_year, gender)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- STORED PROCEDURE — RefreshSummary
-- -------------------------------------------------------------
DELIMITER //

CREATE PROCEDURE RefreshSummary()
BEGIN
    TRUNCATE TABLE summary_demographics;

    INSERT INTO summary_demographics
        (province_id, district_id, commune_id, village_id, birth_year, gender, total_people)
    SELECT
        province_id,
        district_id,
        commune_id,
        village_id,
        YEAR(dob)  AS birth_year,
        gender,
        COUNT(*)   AS total_people
    FROM people
    WHERE dob IS NOT NULL
    GROUP BY province_id, district_id, commune_id, village_id, YEAR(dob), gender;
END //

DELIMITER ;

-- -------------------------------------------------------------
-- TRIGGER — keep summary up to date on person update
-- -------------------------------------------------------------
DELIMITER //

DROP TRIGGER IF EXISTS after_person_update //

CREATE TRIGGER after_person_update
AFTER UPDATE ON people
FOR EACH ROW
BEGIN
    IF (OLD.province_id <=> NEW.province_id) = 0 OR
       (OLD.district_id <=> NEW.district_id) = 0 OR
       (OLD.commune_id  <=> NEW.commune_id)  = 0 OR
       (OLD.village_id  <=> NEW.village_id)  = 0 OR
       (OLD.gender      <=> NEW.gender)       = 0 OR
       YEAR(OLD.dob)   != YEAR(NEW.dob)
    THEN
        -- Decrement old bucket
        UPDATE summary_demographics
        SET    total_people = GREATEST(0, total_people - 1)
        WHERE  province_id = OLD.province_id
          AND  district_id = OLD.district_id
          AND  commune_id  = OLD.commune_id
          AND  village_id  = OLD.village_id
          AND  birth_year  = YEAR(OLD.dob)
          AND  gender      = OLD.gender;

        -- Increment (or create) new bucket
        INSERT INTO summary_demographics
            (province_id, district_id, commune_id, village_id, birth_year, gender, total_people)
        VALUES
            (NEW.province_id, NEW.district_id, NEW.commune_id, NEW.village_id,
             YEAR(NEW.dob), NEW.gender, 1)
        ON DUPLICATE KEY UPDATE
            total_people = total_people + 1;
    END IF;
END //

DELIMITER ; 