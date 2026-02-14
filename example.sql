SELECT 
    p.name AS province_name,
    d.name AS district_name,
    COUNT(dp.id) AS total_people
FROM tbl_district d
JOIN tbl_province p 
    ON d.province_id = p.id
JOIN people dp
    ON dp.province_id = p.id
   AND dp.district_id = d.id
GROUP BY p.name, d.name
ORDER BY p.name, d.name;
SELECT COUNT(*) FROM people WHERE province_id=1;
select province_id,COUNT(*) FROM people GROUP BY province_id;
SELECT * FROM people WHERE id=1;
SELECT id FROM people WHERE province_id=1;

SELECT * FROM tbl_district;
SELECT COUNT(*) FROM people WHERE province_id=1 AND 
district_id IS null;
SELECT district_id,COUNT(*) FROM people WHERE province_id=1 
GROUP BY district_id;
UPDATE people SET district_id=102 WHERE province_id=1 
and id BETWEEN 1800000 AND 2000000;





