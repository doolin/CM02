const MAX_FIELD_LENGTH = 2000;

const REQUIRED_FIELDS = ["frequency", "circumstances"];

const ALL_FIELDS = [
  "frequency",
  "circumstances",
  "objA01",
  "objA02",
  "objB01",
  "objB02",
  "objB03",
  "examineResponse",
  "interviewResponse",
  "testResponse",
];

function validate(input) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    const val = (input[field] || "").trim();
    if (!val) {
      errors.push(`${field} is required`);
    }
  }

  for (const field of ALL_FIELDS) {
    const val = (input[field] || "").trim();
    if (val.length > MAX_FIELD_LENGTH) {
      errors.push(`${field} must be ${MAX_FIELD_LENGTH} characters or fewer`);
    }
  }

  return errors;
}

module.exports = { validate, ALL_FIELDS };
