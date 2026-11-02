-- Import GF2 Telugu 2026 emails from Lakshminadh's updated data (02 Nov 2026)
-- Only updates users who are enrolled in a GF2 Telugu course AND currently have
-- a placeholder email (@noemail.bvrv). Does NOT overwrite real emails.
--
-- Run: psql $DATABASE_URL -f import-gf2-telugu-emails.sql
--
-- Each UPDATE below matches by name (case-insensitive, trimmed) against users
-- enrolled in the current GF2 Telugu subject. Review the output: each row prints
-- old email -> new email so you can verify before committing.

BEGIN;

-- Helper: update email only if currently a placeholder
CREATE OR REPLACE FUNCTION _update_gf2_email(p_name TEXT, p_new_email TEXT)
RETURNS TABLE(user_id UUID, user_name TEXT, old_email TEXT, new_email TEXT) AS $$
  UPDATE users u
  SET email = p_new_email
  FROM class_enrollments ce
  JOIN subjects s ON s.id = ce.subject_id
  JOIN courses c ON c.id = s.course_id
  WHERE ce.student_id = u.id
    AND u.role = 'student'
    AND LOWER(TRIM(u.name)) = LOWER(TRIM(p_name))
    AND u.email LIKE '%@noemail.bvrv'
    AND LOWER(c.name) LIKE '%gita foundation 2%'
  RETURNING u.id, u.name, u.email AS old_email, p_new_email AS new_email
$$ LANGUAGE sql;

-- The 50 devotees with real emails from the spreadsheet:
SELECT * FROM _update_gf2_email('B NAVEEN KUMAR', 'naveenrekha007@gmail.com');
SELECT * FROM _update_gf2_email('Banda Savithri', 'bandasavithri1960@gmail.com');
SELECT * FROM _update_gf2_email('Bhavana D', 'bhavanadabikar@gmail.com');
SELECT * FROM _update_gf2_email('Chandrashekar.Karnati', 'shekarkarnati@gmail.com');
SELECT * FROM _update_gf2_email('Durga Padakanti', 'praveenbhagya749@gmail.com');
SELECT * FROM _update_gf2_email('G. Madura vani', 'madhuravanigottam983@gmail.com');
SELECT * FROM _update_gf2_email('G. Srinidhi Neeraja', 'gsrinidhi1603@gmail.com');
SELECT * FROM _update_gf2_email('Gadde Pallavi', 'gaddetapasya2017@gmail.com');
SELECT * FROM _update_gf2_email('Kalyani sara', 'sarakalyani729@gmail.com');
SELECT * FROM _update_gf2_email('K. Karunakar Reddy', 'kandadi.karunakar@gmail.com');
SELECT * FROM _update_gf2_email('Keerthi C', 'anukeerthi28@gmail.com');
SELECT * FROM _update_gf2_email('P. Krishna Prasad Reddy', 'krishnaprasadreddy2@gmail.com');
SELECT * FROM _update_gf2_email('KRISHNA TALARI', 'krishnatalari1965@gmail.com');
SELECT * FROM _update_gf2_email('M. Ramesh Kumar', 'rk-medha@yahoo.com');
SELECT * FROM _update_gf2_email('M. Vinay kumar', 'madda.vinay@gmail.com');
SELECT * FROM _update_gf2_email('MALLESH SRIRAM', 's.mallesh09@gmail.com');
SELECT * FROM _update_gf2_email('Manjari Sarvani K', 'sarvaniramesh9494@gmail.com');
SELECT * FROM _update_gf2_email('Manjula', 'manjula1231992@gmail.com');
SELECT * FROM _update_gf2_email('Nagamani P', 'nagamanipapadasu@gmail.com');
SELECT * FROM _update_gf2_email('Nalakonda Indumathi', 'indumathinalakonda@gmail.com');
SELECT * FROM _update_gf2_email('Namrata Kalva', 'namratakalva@gmail.com');
SELECT * FROM _update_gf2_email('Navya Reddy', 'navyagreddy4@gmail.com');
SELECT * FROM _update_gf2_email('Preethi C', 'chandrarajulaprethi27@gmail.com');
SELECT * FROM _update_gf2_email('Puppala Radha Madhavi', 'puppalaradhamadhavi@gmail.com');
SELECT * FROM _update_gf2_email('Radharani Bai M', 'radharanibai@gmail.com');
SELECT * FROM _update_gf2_email('Rajesh Gupta B', 'rajeshgupta.bondugula@gmail.com');
SELECT * FROM _update_gf2_email('Ramesh Mallikarjuna', 'omsaimedical_malik@yahoo.com');
SELECT * FROM _update_gf2_email('Ramya Sara', 'sararamya40@gmail.com');
SELECT * FROM _update_gf2_email('Ratna Parameshwar Reddy', 'parameshwarr@gmail.com');
SELECT * FROM _update_gf2_email('G Rama Parvathi', 'ramaparvathi2@gmail.com');
SELECT * FROM _update_gf2_email('Sadanandam Ravishetti', 'sadanandam0404@gmail .com');
SELECT * FROM _update_gf2_email('P Sandhya', 'sandhyapakeer14@gmail.com');
SELECT * FROM _update_gf2_email('Bondugula Shilpa', 'bondgula.shilpa@gmail.com');
SELECT * FROM _update_gf2_email('Shivani E', 'shivanigoud030@gmail.com');
SELECT * FROM _update_gf2_email('P Shyam Sunder Reddy', 'ssrpingeli@gmail.com');
SELECT * FROM _update_gf2_email('Sirnam Omprakash', 'sirnamomprakash@gmail.com');
SELECT * FROM _update_gf2_email('Srilatha B', 'srilatha.15123@gmail.com');
SELECT * FROM _update_gf2_email('Srinu Panjala', 'panjalasrinu@gmail.com');
SELECT * FROM _update_gf2_email('SRIRAM DIVYA', 's.mallesh09@gmail.com');
SELECT * FROM _update_gf2_email('Sriramulu Burrannala', 'sriram7666@gmail.com');
SELECT * FROM _update_gf2_email('Srujana G', 'jaanusuman2009@gmail.com');
SELECT * FROM _update_gf2_email('S V Subba Rao', 'svsubbarao449@gmail.com');
SELECT * FROM _update_gf2_email('Sudarshan Bade', 'sudarshanbade@gmail.com');
SELECT * FROM _update_gf2_email('Suneetha N', 'suneethachanti.chanti@gmail.com');
SELECT * FROM _update_gf2_email('SUNITHA DEVI BOJJA', 'bhanusiri12359@gmail.com');
SELECT * FROM _update_gf2_email('TEJASWI KOYALKAR', 'tejaswik026@gmail.com');
SELECT * FROM _update_gf2_email('UMARANI KOYALKAR MJI', 'koyalkarumarani@gmail.com');
SELECT * FROM _update_gf2_email('Vaishnavi G', 'vaishnavigandala2001@gmail.com');
SELECT * FROM _update_gf2_email('Devara Setti Krishna Kumar', 'radekrsana@gmail.com');
SELECT * FROM _update_gf2_email('MALATHI LATHA POTLURI MJI', 'malathilatha6363@gmail.com');

-- Cleanup
DROP FUNCTION _update_gf2_email(TEXT, TEXT);

-- Review the output above, then:
-- COMMIT;   -- to keep changes
-- ROLLBACK; -- to undo
