export default {
  layout: (data) => (data.permalink === false ? false : data.layout),
  og_image: (data) => {
    let path;
    if (data.og_image) {
      path = data.og_image;
    } else if (data.preview) {
      path = data.preview.src;
    } else if (data.portfolio_preview) {
      path = data.portfolio_preview.src;
    } else if (data.images && data.images.length > 0) {
      path = data.images[0].src;
    }

    if (!path) return false;

    return new URL(path, data.site.url).toString();
  },
};
