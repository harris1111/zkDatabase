/* eslint-disable no-unused-vars */
import { GroupDescription } from '../../types';

export interface ZKGroup {
  addUsers(userNames: string[]): Promise<boolean>;
  removeUsers(userNames: string[]): Promise<boolean>;
  getDescription(): Promise<GroupDescription>;
  changeDescription(description: string): Promise<boolean>;
}
