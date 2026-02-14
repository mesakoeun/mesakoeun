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
    gender ENUM('Male', 'Female', 'Other'),
    dob DATE,
    province_id INT,
    district_id INT,
    commune_id INT,
    village_id INT,
    create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Index for Name searches (Surname and Givenname)
ALTER TABLE people ADD INDEX idx_surname (surname);
ALTER TABLE people ADD INDEX idx_givenname (givenname);

-- Index for Age and Gender filtering
ALTER TABLE people ADD INDEX idx_dob (dob);
ALTER TABLE people ADD INDEX idx_gender (gender);

-- Composite Index for Geographic location (Optimizes searching from Province down to Village)
ALTER TABLE people ADD INDEX idx_location (province_id, district_id, commune_id, village_id);