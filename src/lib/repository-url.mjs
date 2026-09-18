// @ts-check

export const repositoryUrlMessage =
  "Use a complete HTTPS repository link without embedded credentials, whitespace, or backslashes.";

/** @param {string} value */
export function parseRepositoryUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new TypeError(repositoryUrlMessage, { cause: error });
  }

  if (
    !/^https:\/\//i.test(value)
    || /[\s\\\u0000-\u001f\u007f]/.test(value)
    || url.protocol !== "https:"
    || !url.hostname
    || url.username
    || url.password
    || /^[^/?#]*@/.test(value.slice(8))
  ) {
    throw new TypeError(repositoryUrlMessage);
  }
  return url;
}
