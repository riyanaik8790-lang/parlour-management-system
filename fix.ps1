 = 'C:\Users\riya\OneDrive\Desktop\cloud-test-companion-main\cloud-test-companion-main\src\routes\index.tsx'  
 = [System.IO.File]::ReadAllText()  
 = .Replace('import hairColor2Img from "@/assets/hair_color_2.jpg";', 'import hairColor2Img from "@/assets/hair_color_2.jpg";' + [char]10 + 'import pedicureImg from "@/assets/pedicure.jpeg";')  
 = .Replace('src: nailImg', 'src: pedicureImg')  
[System.IO.File]::WriteAllText(, , [System.Text.UTF8Encoding]::new(False)) 
