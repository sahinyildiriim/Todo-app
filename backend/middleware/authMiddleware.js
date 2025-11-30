const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const token = req.header("Authorization");

  // Token yoksa
  if (!token) {
    return res.status(401).json({ message: "Yetkisiz erişim. Token yok." });
  }

  try {
    // Token "Bearer asdfasdf..." şeklinde gelir → ayırıyoruz
    const splitToken = token.split(" ")[1];

    // Token doğrula
    const verified = jwt.verify(splitToken, process.env.JWT_SECRET);

    // Token geçerli → kullanıcıyı request içine koy
    req.user = verified;

    next(); // devam et
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ message: "Geçersiz token." });
  }
};
