const bcrypt = require("bcrypt");

// 비밀번호 해싱 및 출력
async function generateHashedPasswords() {
  const studentPassword = "student"; // 학생 계정 비밀번호
  const adminPassword = "admin"; // 관리자 계정 비밀번호

  // bcrypt로 비밀번호 해싱
  const studentHashed = await bcrypt.hash(studentPassword, 10);
  const adminHashed = await bcrypt.hash(adminPassword, 10);

  console.log("학생 계정 비밀번호 해시:", studentHashed);
  console.log("관리자 계정 비밀번호 해시:", adminHashed);

  // MySQL INSERT SQL 출력
  console.log(`
        INSERT INTO Users (username, password, role)
        VALUES 
            ('student', '${studentHashed}', 'student'),
            ('admin', '${adminHashed}', 'admin');
    `);
}

// 실행
generateHashedPasswords().catch(console.error);
