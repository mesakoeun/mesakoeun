CREATE TABLE tbl_province (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_province_name (name)
) ENGINE=InnoDB;

CREATE TABLE tbl_district (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    province_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_district_province
        FOREIGN KEY (province_id)
        REFERENCES tbl_province(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_province_id (province_id),
    UNIQUE KEY uk_district (province_id, name)
) ENGINE=InnoDB;

CREATE TABLE tbl_commune (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    province_id INT UNSIGNED NOT NULL,
    district_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_commune_province
        FOREIGN KEY (province_id)
        REFERENCES tbl_province(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_commune_district
        FOREIGN KEY (district_id)
        REFERENCES tbl_district(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_district_id (district_id),
    UNIQUE KEY uk_commune (district_id, name)
) ENGINE=InnoDB;

CREATE TABLE tbl_village (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    province_id INT UNSIGNED NOT NULL,
    district_id INT UNSIGNED NOT NULL,
    commune_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_village_province
        FOREIGN KEY (province_id)
        REFERENCES tbl_province(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_village_district
        FOREIGN KEY (district_id)
        REFERENCES tbl_district(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_village_commune
        FOREIGN KEY (commune_id)
        REFERENCES tbl_commune(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_commune_id (commune_id),
    UNIQUE KEY uk_village (commune_id, name)
) ENGINE=InnoDB;

CREATE TABLE people (
    id INT AUTO_INCREMENT PRIMARY KEY,
    givenname VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    gender ENUM('Male', 'Female') NOT NULL,
    dob DATE,
    province_id INT,
    district_id INT,
    commune_id INT,
    village_id INT,
    create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE summary_demographics (
    province_id INT,
    district_id INT,
    commune_id INT,
    village_id INT,
    birth_year INT,
    gender ENUM('Male', 'Female'),
    total_people INT,
    -- Add index for lightning fast filtering
    INDEX (province_id, district_id, commune_id, birth_year),
    UNIQUE KEY uk_summary (province_id, district_id, commune_id, village_id, birth_year, gender)
);

DELIMITER //

CREATE PROCEDURE RefreshSummary()
BEGIN
    -- 1. Clear old summary
    TRUNCATE TABLE summary_demographics;

    -- 2. Insert new calculations
    INSERT INTO summary_demographics (province_id, district_id, commune_id, village_id, birth_year, gender, total_people)
    SELECT 
        province_id, 
        district_id, 
        commune_id, 
        village_id, 
        YEAR(dob) as birth_year,
        gender,
        COUNT(*) as total_people
    FROM people
    GROUP BY province_id, district_id, commune_id, village_id, YEAR(dob), gender;
END //

DELIMITER ;

-- Index for Name searches
ALTER TABLE people ADD INDEX idx_surname (surname);
ALTER TABLE people ADD INDEX idx_givenname (givenname);

-- Index for Age and Gender filtering
ALTER TABLE people ADD INDEX idx_dob (dob);
ALTER TABLE people ADD INDEX idx_gender (gender);

-- Composite Index for Geographic location
ALTER TABLE people ADD INDEX idx_location (province_id, district_id, commune_id, village_id);

DELIMITER //

DROP TRIGGER IF EXISTS after_person_update //

CREATE TRIGGER after_person_update
AFTER UPDATE ON people
FOR EACH ROW
BEGIN
    IF (OLD.province_id != NEW.province_id OR 
        OLD.district_id != NEW.district_id OR 
        OLD.commune_id != NEW.commune_id OR 
        OLD.village_id != NEW.village_id OR 
        OLD.gender != NEW.gender OR 
        YEAR(OLD.dob) != YEAR(NEW.dob)) THEN

        UPDATE summary_demographics
        SET total_people = GREATEST(0, total_people - 1)
        WHERE province_id = OLD.province_id 
          AND district_id = OLD.district_id
          AND commune_id = OLD.commune_id
          AND village_id = OLD.village_id
          AND birth_year = YEAR(OLD.dob)
          AND gender = OLD.gender;

        INSERT INTO summary_demographics 
            (province_id, district_id, commune_id, village_id, birth_year, gender, total_people)
        VALUES 
            (NEW.province_id, NEW.district_id, NEW.commune_id, NEW.village_id, YEAR(NEW.dob), NEW.gender, 1)
        ON DUPLICATE KEY UPDATE 
            total_people = total_people + 1;
    END IF;
END //

DELIMITER ;

-- Composite index for reporting performance
CREATE INDEX idx_report_performance 
ON people (province_id, district_id, commune_id, village_id, gender, dob);
