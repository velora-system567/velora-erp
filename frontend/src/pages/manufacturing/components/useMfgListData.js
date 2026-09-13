import { getListData } from "./mfgTabData";

export function useMfgListData(queryResult) {
  const list = getListData(queryResult);
  return {
    list,
    isEmpty: !queryResult?.isPending && Array.isArray(list) && list.length === 0,
    isLoading: Boolean(queryResult?.isPending),
    error: queryResult?.error,
  };
}
