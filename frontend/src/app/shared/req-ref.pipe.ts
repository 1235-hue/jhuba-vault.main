import { Pipe, PipeTransform } from '@angular/core';
import { requestRef } from './format';

@Pipe({ name: 'reqRef', standalone: true })
export class ReqRefPipe implements PipeTransform {
  transform(id: string | null | undefined): string {
    return requestRef(id);
  }
}
