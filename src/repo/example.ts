import { appDb } from "../provider/db";
import { http, type HttpClient } from "../provider/http";

export interface IExampleRepo {
  listFromDb(limit: number): Promise<unknown[]>;
  fetchFromHttp(url: string): Promise<unknown>;
}

// Copy this class when creating a new repo. Keep OO + constructor DI.
export class ExampleRepo implements IExampleRepo {
  constructor(private readonly httpClient: HttpClient) {}

  async listFromDb(limit: number): Promise<unknown[]> {
    // Example of safe, parameterized SQL.
    return appDb.query<unknown>("SELECT * FROM users ORDER BY created_at DESC, id DESC LIMIT ?", [limit]);
  }

  async fetchFromHttp(url: string): Promise<unknown> {
    return this.httpClient.getJson<unknown>(url);
  }
}

// Composition root default instance.
export const exampleRepo: IExampleRepo = new ExampleRepo(http);
