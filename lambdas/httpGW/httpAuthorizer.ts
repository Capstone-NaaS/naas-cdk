export const handler = async (event) => {
  return {
    isAuthorized: event.headers.authorization === process.env.SECRET_KEY,
  };
};
