-- Check JPEG SOF dimensions on the server, not only in the browser converter.
-- A small compressed file must not become an unbounded image in every gallery card.
create or replace function public.valid_explore_cover(value text) returns boolean
language plpgsql immutable set search_path='' as $$
declare bytes bytea; total integer; pos integer:=2; marker integer; segment_size integer; w integer; h integer; has_size boolean:=false;
begin
 if value='' then return true; end if;
 if value is null or octet_length(value)>87408 or value !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
 bytes:=decode(substr(value,24),'base64'); total:=octet_length(bytes);
 if total not between 4 and 65536 or substring(bytes from 1 for 3)<>decode('ffd8ff','hex') or substring(bytes from total-1 for 2)<>decode('ffd9','hex') then return false; end if;
 while pos+3<total loop
  if get_byte(bytes,pos)<>255 then return false; end if;
  while pos+1<total and get_byte(bytes,pos+1)=255 loop pos:=pos+1; end loop;
  marker:=get_byte(bytes,pos+1);
  if marker=218 then return has_size; end if;
  if marker in (0,216,217) then return false; end if;
  if marker=1 or marker between 208 and 215 then pos:=pos+2; continue; end if;
  segment_size:=get_byte(bytes,pos+2)*256+get_byte(bytes,pos+3);
  if segment_size<2 or pos+2+segment_size>total then return false; end if;
  if marker in (192,193,194) then
   if segment_size<8 then return false; end if;
   h:=get_byte(bytes,pos+5)*256+get_byte(bytes,pos+6);
   w:=get_byte(bytes,pos+7)*256+get_byte(bytes,pos+8);
   if w not between 1 and 480 or h not between 1 and 300 then return false; end if;
   has_size:=true;
  end if;
  pos:=pos+2+segment_size;
 end loop;
 return false;
exception when others then return false;
end; $$;
