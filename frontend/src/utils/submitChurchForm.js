import api from "../components/api";

export async function submitChurchForm(formKey, values, attachmentFile = null) {
  const fd = new FormData();

  fd.append(
    "payload",
    JSON.stringify({
      formKey,
      ...values,
    })
  );

  if (attachmentFile) {
    fd.append("attachment", attachmentFile);
  }

  const { data } = await api.post("/forms/submit", fd, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return data;
}