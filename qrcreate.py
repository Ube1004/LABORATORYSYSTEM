from unicodedata import category

import qrcode

def qrcreate(category, type_, count):

   Type = type_.upper().strip()

   category = category.upper().strip()

   id = f"{count:03d}".upper().strip()

   if Type == "":
        return "Type is required for QR code generation."
   

   fc= category[0] + Type[0]

   id2 = fc + id

   #if id2 == "CANCEL" or id2 == "EXIT" or id2 == "":
        
   #   return "QR code generation cancelled."
        

   file_path = f"qrcodes/{id2}.png"

   qr = qrcode.QRCode()

   qr.add_data(id2)


        

   img = qr.make_image()
   img.save(file_path)

   print("QR code generated and saved to:", file_path)


