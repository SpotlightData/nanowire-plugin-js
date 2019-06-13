const getCurrentDateStamp = () => {
  const d = new Date();

  return d.toISOString();
};

export default getCurrentDateStamp;
