import { attach, createApi, createEffect, createEvent, createStore, sample } from 'effector';
import { NavigateFunction } from 'react-router-dom';

import { Chain } from '@renderer/entities/chain';
import { Asset } from '@renderer/entities/asset';
import { useChains } from '@renderer/entities/network';
import { ChainId } from '@renderer/domain/shared-kernel';

const { getChainById } = useChains();

type Navigation = {
  redirectPath: string;
  navigate: NavigateFunction;
};
const $navigation = createStore<Navigation | null>(null);
const navigationApi = createApi($navigation, {
  navigateApiChanged: (state, { navigate, redirectPath }) => ({ ...state, navigate, redirectPath }),
});

export const $chain = createStore<Chain | null>(null);
export const $asset = createStore<Asset | null>(null);

const validateUrlParams = createEvent<URLSearchParams>();

type ValidateParams = {
  chainId: string | null;
  assetId: string | null;
};
const getChainAndAssetFx = createEffect(async ({ chainId, assetId }: ValidateParams) => {
  if (!chainId || !assetId) return undefined;

  const chain = await getChainById(chainId as ChainId);
  const asset = chain?.assets.find((a) => a.assetId === Number(assetId));

  return { chain, asset };
});

sample({
  clock: validateUrlParams,
  fn: (urlParams) => ({
    chainId: urlParams.get('chainId'),
    assetId: urlParams.get('assetId'),
  }),
  target: getChainAndAssetFx,
});

sample({
  clock: getChainAndAssetFx.doneData,
  fn: (data) => data?.chain || null,
  target: $chain,
});

sample({
  clock: getChainAndAssetFx.doneData,
  fn: (data) => data?.asset || null,
  target: $asset,
});

sample({
  clock: getChainAndAssetFx.doneData,
  filter: (data) => !data?.chain || !data?.asset,
  target: attach({
    source: $navigation,
    effect: (state) => state?.navigate(state?.redirectPath, { replace: true }),
  }),
});

export const events = {
  navigateApiChanged: navigationApi.navigateApiChanged,
  validateUrlParams,
};
