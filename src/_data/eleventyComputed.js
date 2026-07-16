export default {
  layout: (data) => (data.permalink === false ? false : data.layout),
};
