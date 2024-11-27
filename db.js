const mysql = require("mysql2");

// MySQL 연결 설정
const pool = mysql.createPool({
  host: "localhost", // MySQL 서버 주소
  user: "root", // MySQL 사용자 이름
  password: "0205", // MySQL 비밀번호
  database: "registration", // 데이터베이스 이름
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool.promise();
