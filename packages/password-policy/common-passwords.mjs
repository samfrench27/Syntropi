// The most used passwords from public breach lists, lowercase. A password is "common" when, after the
// normalising in index.mjs, it matches one of these. Kept deliberately modest: the aim is to stop the
// passwords attackers try first, not to second-guess every plausible choice.
export const COMMON = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345', '1234', '111111', '000000', '121212',
  '123123', '654321', '666666', '696969', '777777', '7777777', '987654321', '112233', '123321', '131313',
  '159753', '555555', '11111111', '88888888', 'aaaaaa', 'abc123', 'abcd1234', 'abcdef', 'abcdefg', 'abcdefgh',
  'password', 'passw0rd', 'pass', 'pass123', 'password1', 'password12', 'password123', 'p@ssw0rd', 'p@ssword',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwertyui', 'qwe123', '123qwe', 'asdfgh', 'asdfghjkl', 'asdf1234', 'zxcvbn',
  'zxcvbnm', '1qaz2wsx', 'qazwsx', 'qazxsw', '1q2w3e', '1q2w3e4r', '1q2w3e4r5t', 'azerty', 'qwertz',
  'letmein', 'letmein123', 'welcome', 'welcome1', 'welcome123', 'admin', 'admin123', 'administrator', 'login',
  'changeme', 'default', 'guest', 'root', 'toor', 'test', 'test123', 'testing', 'secret', 'secret123',
  'iloveyou', 'iloveyou1', 'loveyou', 'lovely', 'love', 'princess', 'sunshine', 'superman', 'batman', 'spiderman',
  'dragon', 'monkey', 'monkey123', 'master', 'shadow', 'killer', 'hunter', 'ranger', 'buster', 'tigger',
  'football', 'football1', 'baseball', 'basketball', 'soccer', 'hockey', 'golf', 'yankees', 'dallas', 'austin',
  'michael', 'jennifer', 'jessica', 'jordan', 'robert', 'thomas', 'daniel', 'andrew', 'george', 'charlie',
  'michelle', 'amanda', 'ashley', 'nicole', 'chelsea', 'matthew', 'joshua', 'taylor', 'maggie', 'ginger',
  'pepper', 'cheese', 'summer', 'winter', 'spring', 'autumn', 'freedom', 'access', 'matrix', 'thunder',
  'computer', 'internet', 'service', 'starwars', 'minecraft', 'pokemon', 'whatever', 'trustno1', 'biteme',
  'mustang', 'harley', 'ferrari', 'porsche', 'mercedes', 'bmw', 'google', 'facebook', 'twitter', 'windows',
  'linux', 'apple', 'samsung', 'iphone', 'sample', 'example', 'demo', 'demo123', 'syntropi', 'syntropi123',
  'london', 'manchester', 'liverpool', 'arsenal', 'chelsea1', 'england', 'britain', 'monday', 'sunday',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'newpassword', 'mypassword', 'yourpassword', 'passwordpassword', 'qwertyqwerty', 'password!', 'letmein!',
]);

// If the normalised password is short and just one of these roots plus decoration (digits, symbols,
// a capital), it is the same password an attacker tries first.
export const ROOTS = ['password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'iloveyou', 'admin', 'changeme', 'syntropi', 'abc123', 'monkey', 'dragon', 'football', 'sunshine'];
