import { storage, u128 } from "near-sdk-as";
import * as marketplace from "./marketplace";

import { Chunk, ChunkMap, TileInfo, LandParcel, CHUNK_SIZE, CHUNK_COUNT } from "./model"

import { Web4Request, Web4Response, bodyUrl } from "./web4";

export function getLandParcelRange(x: i32, y: i32, width: i32, height: i32): LandParcel[] {
  return marketplace.getLandParcelRange(x, y, width, height);
}

export function offerChunk(x: u32, y: u32, price: string): void {
  marketplace.offerParcel(x, y, u128.from(price));
}

export function buyParcel(x: u32, y: u32): void {
  marketplace.buyParcel(x, y);
}

export function setTiles(tiles: TileInfo[]): void {
  assert(tiles.length > 0, 'setting 0 tiles not supported');

  let firstTile = tiles[0];
  let parcelX = firstTile.x / CHUNK_SIZE / CHUNK_COUNT;
  let parcelY = firstTile.y / CHUNK_SIZE / CHUNK_COUNT;
  let map = ChunkMap.get(parcelX, parcelY);
  map.setTiles(tiles);
}

export function getChunk(x: i32, y: i32): Chunk {
  return Chunk.get(x, y);
}

export function getParcelNonces(x: i32, y: i32): i32[][] {
  return ChunkMap.get(x, y).chunkNonces;
}

export function getAccountId(peerId: string): string | null {
  return storage.getString('accountId:' + peerId);
}

export function web4_get(request: Web4Request): Web4Response {
  // Serve everything from IPFS for now
  return bodyUrl(`ipfs://bafybeigtmldjlcrbstam5wgy3qtl2me7vwowo2jp4igunzum5gwfu3vkpi${request.path}`);
}