export default function checkEnvExistence(envVar) {
  if (!process.env[envVar]) throw new Error(`Environment variable ${envVar} is not set`);

  return true;
}
