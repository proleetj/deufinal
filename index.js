const db = require("./db");

async function testDB() {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS solution");
    console.log("연결 성공! 결과:", rows[0].solution);
  } catch (error) {
    console.error("데이터베이스 연결 실패:", error);
  }
}

testDB();
